import { writeFile } from 'node:fs/promises'
import { dialog, ipcMain, type BrowserWindow, type IpcMainInvokeEvent } from 'electron'
import { IpcChannels } from '../../shared/ipc-channels'
import type { IpcContract } from '../../shared/ipc-contract'
import {
  ExportHistoryFormatSchema,
  IpcIdSchema,
  IpcUrlSchema,
  StartDownloadRequestSchema,
  TorrentFileSelectionSchema,
  validateIpcPayload,
  withIpcErrorBoundary
} from '../../shared/ipc-validation'
import type { DownloadManager } from '../download/downloadManager'
import { listHistory } from '../download/history'
import { pendingLink, releaseLink } from '../openLinks'
import { logAuditEvent } from './auditLogger'
import { assertRateLimit } from './rateLimiter'

function handleSafe<K extends keyof IpcContract>(
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

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`
}

function formatDuration(seconds: number): string {
  if (seconds < 60) return `${seconds}s`
  const minutes = Math.floor(seconds / 60)
  const remainingSec = seconds % 60
  if (minutes < 60) return `${minutes}m ${remainingSec}s`
  const hours = Math.floor(minutes / 60)
  const remainingMin = minutes % 60
  return `${hours}h ${remainingMin}m ${remainingSec}s`
}

function escapeCsv(val: string | number | undefined | null): string {
  const str = String(val ?? '')
  if (/[",\n\r]/.test(str)) {
    return `"${str.replace(/"/g, '""')}"`
  }
  return str
}

export function registerDownloadIpcHandlers(
  manager: DownloadManager,
  getWindow: () => BrowserWindow | null
): void {
  handleSafe('startDownload', async (_event, request, linkId) => {
    const startTime = Date.now()
    const validatedRequest = validateIpcPayload(StartDownloadRequestSchema, request)
    const browser = linkId === undefined ? undefined : pendingLink(linkId)?.browser
    const id = await manager.start(
      browser && validatedRequest.kind === 'http'
        ? { ...validatedRequest, browser }
        : validatedRequest
    )
    if (linkId !== undefined) releaseLink(linkId)
    logAuditEvent({
      channel: 'startDownload',
      action: 'download_started',
      status: 'success',
      details: {
        id,
        kind: validatedRequest.kind,
        fileName: validatedRequest.suggestedFileName,
        destinationDir: validatedRequest.destinationDir,
        totalBytes: validatedRequest.totalBytes
      },
      durationMs: Date.now() - startTime
    })
    return id
  })

  handleSafe('listDownloads', async () => manager.listDownloads())

  handleSafe('listHistory', async () => listHistory())

  handleSafe('exportHistory', async (_event, format = 'csv') => {
    const validatedFormat = validateIpcPayload(ExportHistoryFormatSchema, format) ?? 'csv'
    const window = getWindow()
    if (!window) return { success: false }

    const isJson = validatedFormat === 'json'
    const ext = isJson ? 'json' : 'csv'
    const today = new Date().toISOString().slice(0, 10)
    const defaultPath = `pulse-transfer-history-${today}.${ext}`

    const saveResult = await dialog.showSaveDialog(window, {
      title: 'Export Transfer History',
      defaultPath,
      filters: isJson
        ? [
            { name: 'JSON', extensions: ['json'] },
            { name: 'CSV', extensions: ['csv'] },
            { name: 'All Files', extensions: ['*'] }
          ]
        : [
            { name: 'CSV (Comma Delimited)', extensions: ['csv'] },
            { name: 'JSON', extensions: ['json'] },
            { name: 'All Files', extensions: ['*'] }
          ]
    })

    if (saveResult.canceled || !saveResult.filePath) {
      return { success: false, canceled: true }
    }

    const entries = await listHistory()
    const filePath = saveResult.filePath
    const targetIsJson = filePath.toLowerCase().endsWith('.json')

    let fileContent: string
    if (targetIsJson) {
      const records = entries.map((entry) => {
        const completedAt = entry.completedAt ?? Date.now()
        const durationSec = Math.max(0, Math.round((completedAt - entry.startedAt) / 1000))
        const avgSpeedMBps =
          durationSec > 0
            ? Number((entry.bytesDownloaded / durationSec / (1024 * 1024)).toFixed(2))
            : 0
        return {
          id: entry.id,
          fileName: entry.fileName,
          destinationPath: entry.destinationPath,
          url: entry.url,
          kind: entry.kind,
          totalBytes: entry.totalBytes,
          bytesDownloaded: entry.bytesDownloaded,
          durationSeconds: durationSec,
          averageSpeedMBps: avgSpeedMBps,
          networksUsed: entry.networks.map((n) => n.name || n.networkId),
          startedAt: new Date(entry.startedAt).toISOString(),
          completedAt: new Date(completedAt).toISOString()
        }
      })
      fileContent = JSON.stringify(records, null, 2)
    } else {
      const headers = [
        'File Name',
        'Size (Bytes)',
        'Size (Formatted)',
        'Duration (Seconds)',
        'Duration (Formatted)',
        'Average Speed (MB/s)',
        'Networks Used',
        'Completed At',
        'URL',
        'Destination Path'
      ]

      const rows = entries.map((entry) => {
        const completedAt = entry.completedAt ?? Date.now()
        const durationSec = Math.max(0, Math.round((completedAt - entry.startedAt) / 1000))
        const avgSpeedMBps =
          durationSec > 0
            ? (entry.bytesDownloaded / durationSec / (1024 * 1024)).toFixed(2)
            : '0.00'
        const networksUsed = entry.networks.map((n) => n.name || n.networkId).join('; ')

        return [
          escapeCsv(entry.fileName),
          escapeCsv(entry.bytesDownloaded),
          escapeCsv(formatBytes(entry.bytesDownloaded)),
          escapeCsv(durationSec),
          escapeCsv(formatDuration(durationSec)),
          escapeCsv(avgSpeedMBps),
          escapeCsv(networksUsed),
          escapeCsv(new Date(completedAt).toISOString()),
          escapeCsv(entry.url),
          escapeCsv(entry.destinationPath)
        ].join(',')
      })

      fileContent = [headers.join(','), ...rows].join('\r\n')
    }

    await writeFile(filePath, fileContent, 'utf-8')
    logAuditEvent({
      channel: 'exportHistory',
      action: 'history_exported',
      status: 'success',
      details: { format: validatedFormat, filePath, recordCount: entries.length }
    })
    return { success: true, filePath }
  })

  handleSafe('clearHistory', async () => {
    await manager.clearHistory()
    logAuditEvent({
      channel: 'clearHistory',
      action: 'history_cleared',
      status: 'success'
    })
  })

  handleSafe('networkUsage', async () => manager.limits.usedByPeriod())
  handleSafe('resetNetworkUsage', async (_event, id) => {
    const validatedId = validateIpcPayload(IpcIdSchema, id)
    return manager.resetNetworkUsage(validatedId)
  })

  handleSafe('torrentFiles', async (_event, id) => {
    const validatedId = validateIpcPayload(IpcIdSchema, id)
    return manager.torrentFiles(validatedId)
  })

  handleSafe('chooseTorrentFiles', async (_event, id, selected) => {
    const validatedId = validateIpcPayload(IpcIdSchema, id)
    const validatedSelected = validateIpcPayload(TorrentFileSelectionSchema, selected)
    return manager.chooseTorrentFiles(validatedId, validatedSelected)
  })

  handleSafe('pauseDownload', async (_event, id) => {
    const validatedId = validateIpcPayload(IpcIdSchema, id)
    await manager.pause(validatedId)
  })

  handleSafe('resumeDownload', async (_event, id) => {
    const validatedId = validateIpcPayload(IpcIdSchema, id)
    manager.resume(validatedId)
  })

  handleSafe('relinkDownload', async (_event, id, url) => {
    const validatedId = validateIpcPayload(IpcIdSchema, id)
    const validatedUrl = validateIpcPayload(IpcUrlSchema, url)
    return manager.relink(validatedId, validatedUrl)
  })

  handleSafe('setDownloadNetwork', async (_event, id, networkId, enabled) => {
    const validatedId = validateIpcPayload(IpcIdSchema, id)
    const validatedNetworkId = validateIpcPayload(IpcIdSchema, networkId)
    await manager.setNetworkEnabled(validatedId, validatedNetworkId, Boolean(enabled))
  })

  handleSafe('cancelDownload', async (_event, id) => {
    const validatedId = validateIpcPayload(IpcIdSchema, id)
    return manager.cancel(validatedId)
  })

  handleSafe('removeDownload', async (_event, id, options) => {
    const validatedId = validateIpcPayload(IpcIdSchema, id)
    const trash = options?.trashFile === true
    const result = await manager.remove(validatedId, trash)
    logAuditEvent({
      channel: 'removeDownload',
      action: 'download_removed',
      status: 'success',
      details: { id: validatedId, trashFile: trash }
    })
    return result
  })

  handleSafe('revealDownload', async (_event, id) => {
    const validatedId = validateIpcPayload(IpcIdSchema, id)
    return manager.reveal(validatedId)
  })

  handleSafe('openDownload', async (_event, id) => {
    const validatedId = validateIpcPayload(IpcIdSchema, id)
    return manager.open(validatedId)
  })
}
