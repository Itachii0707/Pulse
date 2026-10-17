import { stat, statfs } from 'node:fs/promises'
import { isAbsolute } from 'node:path'
import {
  clipboard,
  dialog,
  ipcMain,
  nativeTheme,
  powerMonitor,
  shell,
  type BrowserWindow,
  type IpcMainInvokeEvent
} from 'electron'
import { IpcChannels } from '../../shared/ipc-channels'
import type { IpcContract } from '../../shared/ipc-contract'
import {
  AppSettingsPatchSchema,
  IpcIdSchema,
  IpcUrlSchema,
  validateIpcPayload,
  withIpcErrorBoundary
} from '../../shared/ipc-validation'
import {
  DEFAULT_SLOW_MODE_SPEED,
  DOWNLOADS_AT_ONCE,
  type InitialState,
  type ThemeSource
} from '../../shared/types'
import { DownloadManager } from '../download/downloadManager'
import { getDefaultDownloadsDir, getHomeDir } from '../download/paths'
import { probeUrl } from '../download/probe'
import { deviceBindingSupported } from '../network/deviceBinding'
import { NetworkMonitor } from '../network/interfaces'
import { pendingLink, pendingLinks, releaseLink } from '../openLinks'
import { DEFAULT_SECURITY_SETTINGS, loadSettings, saveSettings } from '../settings'
import { showUpdateMenu, updateState } from '../updater'
import { logAuditEvent } from './auditLogger'
import { registerDownloadIpcHandlers } from './downloadHandlers'
import { assertRateLimit } from './rateLimiter'

async function openNetworkSettings(): Promise<void> {
  if (process.platform === 'win32') {
    await shell.openExternal('ms-settings:network-status')
  } else if (process.platform === 'darwin') {
    await shell.openExternal('x-apple.systempreferences:com.apple.preference.network')
  } else if (process.platform === 'linux') {
    try {
      const { exec } = await import('node:child_process')
      exec('gnome-control-center network || nm-connection-editor || true')
    } catch {
      // Best-effort
    }
  }
}

/** Typed wrapper around ipcMain.handle with error boundary and rate limit validation. */
function handle<K extends keyof IpcContract>(
  channel: K,
  listener: (
    event: IpcMainInvokeEvent,
    ...args: IpcContract[K]['args']
  ) => IpcContract[K]['result'] | Promise<IpcContract[K]['result']>
): void {
  ipcMain.handle(IpcChannels[channel], async (event, ...args) => {
    assertRateLimit(String(channel))
    return withIpcErrorBoundary(String(channel), async () => {
      return (listener as (event: IpcMainInvokeEvent, ...args: unknown[]) => unknown)(
        event,
        ...args
      ) as IpcContract[K]['result']
    })
  })
}

const DESTINATION_CHECK_MS = 300

async function freeSpace(dir: string): Promise<number | null> {
  if (typeof dir !== 'string' || !isAbsolute(dir)) return null
  try {
    const stats = await statfs(dir)
    return stats.bavail * stats.bsize
  } catch {
    return null
  }
}

export function registerIpcHandlers(getWindow: () => BrowserWindow | null): DownloadManager {
  // The main process keeps the network list, for downloads and the window alike.
  const networks = new NetworkMonitor((list) => {
    manager.networksChanged()
    const window = getWindow()
    if (window && !window.isDestroyed()) window.webContents.send(IpcChannels.networksChanged, list)
  })
  const manager = new DownloadManager(getWindow, networks)
  // Waking from sleep, the networks may have changed without a poll in between to see it.
  powerMonitor.on('resume', () => {
    manager.systemResumed()
    void networks.refresh()
  })

  // System & Network handlers
  handle('listInterfaces', () => networks.refresh())

  const bindingSupport = deviceBindingSupported()
  handle('deviceBindingSupported', async () => bindingSupport)

  const currentThemeSource = (): ThemeSource =>
    nativeTheme.themeSource === 'dark'
      ? 'dark'
      : nativeTheme.themeSource === 'light'
        ? 'light'
        : 'system'

  handle('updateSettings', async (_event, patch) => {
    const startTime = Date.now()
    const validatedPatch = validateIpcPayload(AppSettingsPatchSchema, patch)
    if (
      validatedPatch?.themeSource === 'light' ||
      validatedPatch?.themeSource === 'dark' ||
      validatedPatch?.themeSource === 'system'
    ) {
      nativeTheme.themeSource = validatedPatch.themeSource
    }
    await saveSettings(validatedPatch)
    await manager.applySettings(await loadSettings())
    logAuditEvent({
      channel: 'updateSettings',
      action: 'settings_update',
      status: 'success',
      details: { keys: Object.keys(validatedPatch ?? {}) },
      durationMs: Date.now() - startTime
    })
  })

  // Synchronous initial state bootstrap
  ipcMain.on(IpcChannels.getInitialState, async (event) => {
    try {
      const settings = await loadSettings()
      const { destinationDir } = settings
      const destinationExists =
        destinationDir !== undefined &&
        (await Promise.race([
          stat(destinationDir).then(
            (stats) => stats.isDirectory(),
            () => false
          ),
          new Promise<boolean>((resolve) => setTimeout(resolve, DESTINATION_CHECK_MS, false))
        ]))
      event.returnValue = {
        downloadSchedule: settings.downloadSchedule,
        homeDir: getHomeDir(),
        downloadsDir: getDefaultDownloadsDir(),
        themeSource: currentThemeSource(),
        networkPreferences: settings.networkPreferences ?? {},
        downloadsAtOnce: settings.downloadsAtOnce ?? DOWNLOADS_AT_ONCE.default,
        speedLimit: settings.speedLimit,
        slowMode: settings.slowMode ?? false,
        slowModeSpeed: settings.slowModeSpeed ?? DEFAULT_SLOW_MODE_SPEED,
        speedUnit: settings.speedUnit ?? 'bytes',
        destinationDir: destinationExists ? destinationDir : undefined,
        onboardingCompleted: settings.onboardingCompleted ?? false,
        security: settings.security ?? DEFAULT_SECURITY_SETTINGS
      } satisfies InitialState
    } catch (error) {
      console.error('[plexo] failed to read initial state', error)
      event.returnValue = {
        homeDir: '',
        downloadsDir: '',
        themeSource: currentThemeSource(),
        networkPreferences: {},
        downloadsAtOnce: DOWNLOADS_AT_ONCE.default,
        slowMode: false,
        slowModeSpeed: DEFAULT_SLOW_MODE_SPEED,
        speedUnit: 'bytes',
        onboardingCompleted: false,
        security: DEFAULT_SECURITY_SETTINGS
      } satisfies InitialState
    }
  })

  handle('openNetworkSettings', async () => {
    await openNetworkSettings()
  })

  handle('probeUrl', async (_event, url) => {
    const validatedUrl = validateIpcPayload(IpcUrlSchema, url)
    return probeUrl(validatedUrl)
  })

  handle('chooseDestinationFolder', async (_event, defaultPath) => {
    const window = getWindow()
    if (!window) return null
    const result = await dialog.showOpenDialog(window, {
      defaultPath,
      properties: ['openDirectory', 'createDirectory']
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  handle('chooseTorrentFile', async () => {
    const window = getWindow()
    if (!window) return null
    const result = await dialog.showOpenDialog(window, {
      properties: ['openFile'],
      filters: [{ name: 'Torrent', extensions: ['torrent'] }]
    })
    if (result.canceled || result.filePaths.length === 0) return null
    return result.filePaths[0]
  })

  handle('pendingLinks', async () => pendingLinks())

  handle('resumeFromLink', async (_event, linkId, downloadId) => {
    const validatedLinkId = validateIpcPayload(IpcIdSchema, linkId)
    const validatedDownloadId = validateIpcPayload(IpcIdSchema, downloadId)
    const link = pendingLink(validatedLinkId)
    if (link?.probe?.kind !== 'http') throw new Error('That download is no longer waiting.')
    await manager.relink(validatedDownloadId, link.probe.finalUrl, {
      probe: link.probe,
      browser: link.browser
    })
    releaseLink(validatedLinkId)
  })

  handle('dismissLink', async (_event, id) => {
    const validatedId = validateIpcPayload(IpcIdSchema, id)
    return releaseLink(validatedId)
  })

  handle('readClipboardText', async () => clipboard.readText())
  handle('freeSpace', async (_event, dir) => freeSpace(dir))
  handle('updateState', () => updateState())
  handle('showUpdateMenu', () => showUpdateMenu())

  // Register all modular download IPC channels
  registerDownloadIpcHandlers(manager, getWindow)

  return manager
}
