import { rm } from 'node:fs/promises'
import { isAbsolute, join } from 'node:path'
import { app } from 'electron'
import {
  DOWNLOADS_AT_ONCE,
  type AppSettings,
  type NetworkPreference,
  type NetworkPreferences,
  type SecuritySettings,
  type ThemeSource
} from '../shared/types'
import { readJson, updateJson } from './jsonFile'
import { DEFAULT_DOWNLOAD_SCHEDULE, validSchedule } from '../shared/downloadSchedule'

export const DEFAULT_SECURITY_SETTINGS: SecuritySettings = {
  blockUnsafeExecutables: false,
  blockedExtensions: ['.bat', '.cmd', '.scr', '.vbs', '.wsf', '.ps1', '.reg', '.msi'],
  scanDownloads: process.platform === 'win32'
}

function sanitizeSecuritySettings(parsed: unknown): SecuritySettings | undefined {
  if (!isRecord(parsed)) return undefined
  const security: SecuritySettings = {}
  if (typeof parsed.blockUnsafeExecutables === 'boolean') {
    security.blockUnsafeExecutables = parsed.blockUnsafeExecutables
  }
  if (Array.isArray(parsed.blockedExtensions)) {
    security.blockedExtensions = parsed.blockedExtensions.filter(
      (ext): ext is string => typeof ext === 'string' && ext.length > 0 && ext.length <= 16
    )
  }
  if (typeof parsed.scanDownloads === 'boolean') {
    security.scanDownloads = parsed.scanDownloads
  }
  return Object.keys(security).length > 0 ? security : undefined
}

function settingsPath(): string {
  return join(app.getPath('userData'), 'app-settings.json')
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value)
}

/** A rate or an amount of bytes: a positive whole number, or nothing. */
function byteCount(value: unknown): number | undefined {
  return Number.isSafeInteger(value) && (value as number) > 0 ? (value as number) : undefined
}

/** Keeps only fields of the right type (what every reader downstream assumes, e.g.
 * NetworkEditPopover's `customName?.trim()`), entry by entry, rather than discarding every
 * network over one bad entry. An entry left with no field is dropped, so resetting a network
 * removes it from the file. */
function sanitizeNetworkPreferences(parsed: unknown): NetworkPreferences {
  if (!isRecord(parsed)) return {}

  const result: NetworkPreferences = {}
  for (const [id, value] of Object.entries(parsed)) {
    if (!isRecord(value)) continue
    const preference: NetworkPreference = {}
    if (typeof value.customName === 'string') preference.customName = value.customName
    if (typeof value.colorId === 'string') preference.colorId = value.colorId
    if (value.off === true) preference.off = true
    preference.speedLimit = byteCount(value.speedLimit)
    preference.dataLimit = byteCount(value.dataLimit)
    if (
      value.dataLimitPeriod === 'day' ||
      value.dataLimitPeriod === 'week' ||
      value.dataLimitPeriod === 'month'
    ) {
      preference.dataLimitPeriod = value.dataLimitPeriod
    }
    for (const key of Object.keys(preference) as (keyof NetworkPreference)[]) {
      if (preference[key] === undefined) delete preference[key]
    }
    if (Object.keys(preference).length > 0) result[id] = preference
  }
  return result
}

/** Trusts nothing past "this is valid JSON" — the file may be hand-edited or from an older
 * version, and a patch comes from the renderer. Every field is checked on its own, so one bad
 * value only loses that value. An `undefined` field in a patch clears it. */
function sanitizeSettings(parsed: unknown): AppSettings {
  if (!isRecord(parsed)) return {}

  const { themeSource, destinationDir, downloadsAtOnce } = parsed
  const settings: AppSettings = {}
  if (parsed.downloadSchedule !== undefined) {
    settings.downloadSchedule = validSchedule(parsed.downloadSchedule)
      ? parsed.downloadSchedule
      : { ...DEFAULT_DOWNLOAD_SCHEDULE, enabled: true, days: [] }
  }
  if (themeSource === 'light' || themeSource === 'dark' || themeSource === 'system') {
    settings.themeSource = themeSource
  }
  if (parsed.autoUpdate === false) settings.autoUpdate = false
  if (typeof destinationDir === 'string' && isAbsolute(destinationDir)) {
    settings.destinationDir = destinationDir
  }
  // Clamped rather than dropped: a count saved under an older, higher limit keeps the most allowed.
  if (Number.isInteger(downloadsAtOnce) && (downloadsAtOnce as number) >= DOWNLOADS_AT_ONCE.min) {
    settings.downloadsAtOnce = Math.min(downloadsAtOnce as number, DOWNLOADS_AT_ONCE.max)
  }
  if (parsed.networkPreferences !== undefined) {
    settings.networkPreferences = sanitizeNetworkPreferences(parsed.networkPreferences)
  }
  const speedLimit = byteCount(parsed.speedLimit)
  if (speedLimit !== undefined) settings.speedLimit = speedLimit
  const slowModeSpeed = byteCount(parsed.slowModeSpeed)
  if (slowModeSpeed !== undefined) settings.slowModeSpeed = slowModeSpeed
  if (parsed.slowMode === true) settings.slowMode = true
  if (parsed.speedUnit === 'bytes' || parsed.speedUnit === 'bits') {
    settings.speedUnit = parsed.speedUnit
  }
  if (parsed.browserExtensionUsed === true) settings.browserExtensionUsed = true
  if (parsed.onboardingCompleted === true) settings.onboardingCompleted = true
  if (parsed.security !== undefined) {
    settings.security = sanitizeSecuritySettings(parsed.security)
  }
  return settings
}

export async function loadSettings(): Promise<AppSettings> {
  // Reading can fall back to defaults; only a save must not act on a failed read.
  try {
    return sanitizeSettings(await readJson(settingsPath()))
  } catch {
    return {}
  }
}

/** Merges `patch` over what's saved. */
export function saveSettings(patch: unknown): Promise<void> {
  if (
    isRecord(patch) &&
    patch.downloadSchedule !== undefined &&
    !validSchedule(patch.downloadSchedule)
  ) {
    return Promise.reject(new Error('Choose different start and stop times and at least one day.'))
  }
  return updateJson(settingsPath(), (current) =>
    sanitizeSettings({ ...sanitizeSettings(current), ...(isRecord(patch) ? patch : {}) })
  )
}

export async function loadThemeSource(): Promise<ThemeSource> {
  const { themeSource } = await loadSettings()
  return themeSource ?? 'system'
}

/** Network names/colors lived in their own network-preferences.json up to 1.0.0-rc.8. Folds
 * that file into app-settings.json once, then deletes it (a corrupt one is just deleted). */
export async function migrateLegacyNetworkPreferences(): Promise<void> {
  const legacyPath = join(app.getPath('userData'), 'network-preferences.json')
  const legacy = await readJson(legacyPath)
  if (legacy !== undefined) {
    await updateJson(settingsPath(), (current) => {
      const settings = sanitizeSettings(current)
      return settings.networkPreferences
        ? settings
        : { ...settings, networkPreferences: sanitizeNetworkPreferences(legacy) }
    })
  }
  await rm(legacyPath, { force: true })
}
