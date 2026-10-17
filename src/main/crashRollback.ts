import * as electron from 'electron'
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const electronApp =
  (electron as unknown as { app?: typeof electron.app }).app ??
  (electron as unknown as { default?: { app?: typeof electron.app } }).default?.app

interface UpdateRecoveryState {
  currentVersion: string
  updatedAt?: number
  crashCount: number
  lastCrashAt?: number
  rollbackTriggered?: boolean
}

const CRASH_THRESHOLD = 3
const STABILITY_WINDOW_MS = 5 * 60 * 1000 // 5 minutes

function getRecoveryFilePath(): string {
  const userData = electronApp?.getPath ? electronApp.getPath('userData') : process.cwd()
  return join(userData, 'update-recovery.json')
}

function loadState(): UpdateRecoveryState {
  try {
    const raw = readFileSync(getRecoveryFilePath(), 'utf-8')
    const parsed = JSON.parse(raw)
    if (typeof parsed === 'object' && parsed !== null) {
      return parsed as UpdateRecoveryState
    }
  } catch {
    // Missing or invalid
  }
  return {
    currentVersion: electronApp?.isReady?.() ? electronApp.getVersion() : '1.0.0',
    crashCount: 0
  }
}

function saveState(state: UpdateRecoveryState): void {
  try {
    writeFileSync(getRecoveryFilePath(), JSON.stringify(state, null, 2), 'utf-8')
  } catch {
    // Best-effort
  }
}

/**
 * Initializes the update crash tracker.
 * Checks if the app was recently updated. If consecutive crashes exceed the threshold,
 * marks rollbackTriggered so the app or updater can revert or alert the user.
 */
export function initCrashRollbackTracker(): { rollbackTriggered: boolean; crashCount: number } {
  const version = electronApp?.isReady?.() ? electronApp.getVersion() : '1.0.0'
  const state = loadState()
  const now = Date.now()

  // New version detected: start observation window
  if (state.currentVersion !== version) {
    state.currentVersion = version
    state.updatedAt = now
    state.crashCount = 0
    state.rollbackTriggered = false
    saveState(state)
    return { rollbackTriggered: false, crashCount: 0 }
  }

  // If stability window has passed cleanly, reset crash count
  if (
    state.updatedAt &&
    now - state.updatedAt > STABILITY_WINDOW_MS &&
    state.crashCount < CRASH_THRESHOLD
  ) {
    state.crashCount = 0
    saveState(state)
  }

  return {
    rollbackTriggered: state.rollbackTriggered ?? false,
    crashCount: state.crashCount
  }
}

/**
 * Records a crash occurring during runtime.
 */
export function recordCrashForRollback(): boolean {
  const state = loadState()
  const now = Date.now()

  state.crashCount = (state.crashCount || 0) + 1
  state.lastCrashAt = now

  if (state.crashCount >= CRASH_THRESHOLD) {
    state.rollbackTriggered = true
    console.error(
      `[pulse:rollback] CRITICAL: ${state.crashCount} consecutive crashes detected on version ${state.currentVersion}. Flagging auto-rollback.`
    )
  }

  saveState(state)
  return state.rollbackTriggered ?? false
}
