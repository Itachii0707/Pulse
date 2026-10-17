/**
 * crashReporter.ts — Pulse crash-observability layer
 *
 * Three complementary layers:
 *  1. Electron built-in crashReporter → writes minidumps to %AppData%\Pulse\crashes\ and, if
 *     PULSE_CRASH_SUBMIT_URL is set, posts them to your crash-ingestion endpoint (e.g. Sentry
 *     native-crash endpoint, or a self-hosted minidump server).
 *  2. Structured JSON error log → rolls per-session to %AppData%\Pulse\logs\errors-<date>.jsonl,
 *     capturing unhandled main-process rejections and uncaught exceptions with full stack traces,
 *     OS metadata, and app version — queryable without a cloud service.
 *  3. Optional Sentry JavaScript SDK → enabled at runtime when PULSE_SENTRY_DSN is set in the
 *     environment or in the build-time baked DSN constant below.  Zero overhead when the DSN is
 *     absent.
 *
 * Usage
 * -----
 *   import { initCrashReporter } from './crashReporter'
 *   initCrashReporter()   // call once, before app.whenReady()
 *
 * Environment variables (set in CI or a .env file, never committed):
 *   PULSE_SENTRY_DSN         — Sentry project DSN for JS exceptions
 *   PULSE_CRASH_SUBMIT_URL   — minidump upload endpoint (Sentry: https://sentry.io/api/<pid>/minidump/?sentry_key=<key>)
 *   PULSE_RELEASE            — overrides app.getVersion() in Sentry events (useful for nightly tags)
 */

import * as electron from 'electron'
import { appendFileSync, mkdirSync } from 'fs'
import { join } from 'path'
import os from 'os'
import { recordCrashForRollback } from './crashRollback'

const electronApp =
  (electron as unknown as { app?: typeof electron.app }).app ??
  (electron as unknown as { default?: { app?: typeof electron.app } }).default?.app
const electronCrashReporter =
  (electron as unknown as { crashReporter?: typeof electron.crashReporter }).crashReporter ??
  (electron as unknown as { default?: { crashReporter?: typeof electron.crashReporter } }).default
    ?.crashReporter

// ─── Constants ────────────────────────────────────────────────────────────────

/** Bake a DSN at build time by setting this to a string literal; leave '' to use env-var only. */
const BAKED_SENTRY_DSN = ''

// ─── Helpers ──────────────────────────────────────────────────────────────────

function logsDir(): string {
  const userData = electronApp?.getPath ? electronApp.getPath('userData') : process.cwd()
  const dir = join(userData, 'logs')
  mkdirSync(dir, { recursive: true })
  return dir
}

function sessionLogPath(): string {
  const date = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  return join(logsDir(), `errors-${date}.jsonl`)
}

function buildEntry(kind: string, error: unknown): string {
  const err = error instanceof Error ? error : new Error(String(error))
  return (
    JSON.stringify({
      ts: new Date().toISOString(),
      kind,
      message: err.message,
      stack: err.stack ?? '',
      version: electronApp?.isReady?.() ? electronApp.getVersion() : 'pre-ready',
      platform: process.platform,
      arch: process.arch,
      os_release: os.release(),
      electron: process.versions.electron,
      node: process.versions.node,
      chrome: process.versions.chrome
    }) + '\n'
  )
}

function writeEntry(kind: string, error: unknown): void {
  try {
    appendFileSync(sessionLogPath(), buildEntry(kind, error))
  } catch {
    // If logging itself fails (e.g. disk full), silently skip — never crash the crash reporter.
  }
}

// ─── Sentry (optional, lazy-loaded) ──────────────────────────────────────────

async function initSentryIfConfigured(dsn: string): Promise<void> {
  // Dynamically import so the package is tree-shaken away entirely if not installed.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  let Sentry: any | undefined
  try {
    const sentryPkg = '@sentry/electron/main'
    Sentry = await import(/* @vite-ignore */ sentryPkg)
  } catch {
    // @sentry/electron is an optional peer dependency — not bundled by default.
    console.info(
      '[pulse:crash] @sentry/electron not installed; JS-level Sentry reporting disabled.\n' +
        '  To enable: npm install --save @sentry/electron'
    )
    return
  }

  Sentry.init({
    dsn,
    release: process.env['PULSE_RELEASE'] ?? electronApp?.getVersion?.() ?? '1.0.0',
    environment: electronApp?.isPackaged ? 'production' : 'development',
    // Upload native minidumps via the Sentry SDK (alternative to electronCrashReporter submitURL).
    // Set to false if you're already using electronCrashReporter with PULSE_CRASH_SUBMIT_URL.
    enableNative: !process.env['PULSE_CRASH_SUBMIT_URL'],
    // Don't capture dev noise when running `npm run dev`
    beforeSend(event) {
      if (!electronApp?.isPackaged) return null
      return event
    }
  })

  console.info(
    `[pulse:crash] Sentry JS reporting active (release=${electronApp?.getVersion?.() ?? '1.0.0'})`
  )
}

// ─── Public API ───────────────────────────────────────────────────────────────

/**
 * Initialise the crash-observability stack.  Call once at the very top of the main process,
 * before `app.whenReady()`, so that startup crashes are captured.
 */
export function initCrashReporter(): void {
  // ── 1. Electron native minidump reporter ──────────────────────────────────
  const submitURL = process.env['PULSE_CRASH_SUBMIT_URL'] ?? ''
  electronCrashReporter?.start?.({
    productName: 'Pulse',
    companyName: 'Pulse',
    submitURL,
    uploadToServer: Boolean(submitURL),
    ignoreSystemCrashHandler: false,
    // Extra key-value metadata attached to every minidump report.
    extra: {
      version: electronApp?.getVersion?.() ?? 'unknown'
    }
  })

  const userData = electronApp?.getPath ? electronApp.getPath('userData') : process.cwd()
  const crashesDir = join(userData, 'crashes')
  mkdirSync(crashesDir, { recursive: true })

  if (submitURL) {
    console.info(`[pulse:crash] Native crash reporter active → ${submitURL}`)
  } else {
    console.info(
      `[pulse:crash] Native crash reporter active (local only — set PULSE_CRASH_SUBMIT_URL to upload)`
    )
  }

  // ── 2. Unhandled main-process exceptions → structured log ─────────────────
  process.on('uncaughtException', (error) => {
    recordCrashForRollback()
    writeEntry('uncaughtException', error)
    console.error('[pulse:crash] uncaughtException', error)
    // Re-emit so Electron's default handler can still record and exit cleanly.
    // Do NOT call process.exit() here — Electron needs to flush its own crash state.
  })

  process.on('unhandledRejection', (reason) => {
    writeEntry('unhandledRejection', reason)
    console.error('[pulse:crash] unhandledRejection', reason)
  })

  // ── 3. FFI segfault guard ─────────────────────────────────────────────────
  // koffi (kernel32.dll, sparseFile.ts) can produce a SIGSEGV if a native handle is corrupt.
  // We can't recover from it, but we can at least record what we know before the OS kills us.
  process.on('SIGSEGV' as NodeJS.Signals, () => {
    writeEntry('SIGSEGV', new Error('Native segmentation fault (likely FFI / koffi handle)'))
    // Cannot continue — let the process die so Electron's crashReporter captures the minidump.
  })

  // ── 4. Optional Sentry JS SDK ─────────────────────────────────────────────
  const dsn = BAKED_SENTRY_DSN || process.env['PULSE_SENTRY_DSN'] || ''
  if (dsn) {
    // app might not be ready yet; defer Sentry init to after the event loop tick.
    setImmediate(() => void initSentryIfConfigured(dsn))
  }
}

/**
 * Manually capture an error and write it to the structured error log.
 * Use this around FFI calls, IPC handlers, or any boundary where an exception is caught but
 * should still be recorded for post-mortem analysis.
 *
 * @example
 *   try {
 *     await setSparse(path, size)
 *   } catch (err) {
 *     captureError('sparseFile:setSparse', err)
 *   }
 */
export function captureError(context: string, error: unknown): void {
  const wrapped = error instanceof Error ? error : new Error(`[${context}] ${String(error)}`)
  if (!(error instanceof Error)) {
    wrapped.stack = `[${context}] non-Error thrown: ${String(error)}`
  }
  writeEntry(`captured:${context}`, wrapped)

  // Forward to Sentry if it was initialised (best-effort, no await).
  void (async () => {
    try {
      const sentryPkg = '@sentry/electron/main'
      const Sentry = await import(/* @vite-ignore */ sentryPkg)
      Sentry.captureException(wrapped, { tags: { context } })
    } catch {
      /* Sentry not installed or not init'd — that's fine */
    }
  })()
}
