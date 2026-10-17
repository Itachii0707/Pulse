import { app } from 'electron'
import { appendFileSync, mkdirSync } from 'node:fs'
import { join } from 'node:path'

export interface AuditLogEntry {
  timestamp: string
  channel: string
  action: string
  status: 'success' | 'failure' | 'blocked' | 'warning'
  details?: Record<string, unknown>
  durationMs?: number
  callerId?: number
}

function getAuditLogsDir(): string {
  const dir = join(app.getPath('userData'), 'logs')
  try {
    mkdirSync(dir, { recursive: true })
  } catch {
    // Best-effort
  }
  return dir
}

function getTodayAuditLogPath(): string {
  const dateStr = new Date().toISOString().slice(0, 10)
  return join(getAuditLogsDir(), `audit-${dateStr}.jsonl`)
}

/**
 * Sanitizes object keys so sensitive fields (cookies, secrets, auth headers) are never stored.
 */
function sanitizeAuditDetails(
  details?: Record<string, unknown>
): Record<string, unknown> | undefined {
  if (!details) return undefined
  const sanitized: Record<string, unknown> = {}
  for (const [key, value] of Object.entries(details)) {
    const lowerKey = key.toLowerCase()
    if (
      lowerKey.includes('token') ||
      lowerKey.includes('cookie') ||
      lowerKey.includes('secret') ||
      lowerKey.includes('password') ||
      lowerKey.includes('auth')
    ) {
      sanitized[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null && !Array.isArray(value)) {
      sanitized[key] = sanitizeAuditDetails(value as Record<string, unknown>)
    } else {
      sanitized[key] = value
    }
  }
  return sanitized
}

/**
 * Records an entry into the structured IPC audit log.
 * Safe against disk write errors — will never throw or crash the caller.
 */
export function logAuditEvent(entry: Omit<AuditLogEntry, 'timestamp'>): void {
  try {
    const fullEntry: AuditLogEntry = {
      timestamp: new Date().toISOString(),
      ...entry,
      details: sanitizeAuditDetails(entry.details)
    }
    const line = JSON.stringify(fullEntry) + '\n'
    appendFileSync(getTodayAuditLogPath(), line, 'utf-8')
  } catch {
    // Silently ignore logging failures to keep core execution stable
  }
}
