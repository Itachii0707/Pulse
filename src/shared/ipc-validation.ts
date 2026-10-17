import { z } from 'zod'

/** Version of the Pulse IPC Protocol for forward and backward compatibility. */
export const IPC_PROTOCOL_VERSION = 1

/** Standardized Structured IPC Error representation. */
export interface StructuredIpcError {
  readonly isIpcError: true
  readonly code: string
  readonly message: string
  readonly details?: unknown
}

export function isStructuredIpcError(val: unknown): val is StructuredIpcError {
  return (
    typeof val === 'object' &&
    val !== null &&
    (val as StructuredIpcError).isIpcError === true &&
    typeof (val as StructuredIpcError).code === 'string' &&
    typeof (val as StructuredIpcError).message === 'string'
  )
}

export function createIpcError(
  code: string,
  message: string,
  details?: unknown
): StructuredIpcError {
  return {
    isIpcError: true,
    code,
    message,
    details
  }
}

// --------------------------------------------------------------------------
// Zod Schemas for IPC Channels
// --------------------------------------------------------------------------

export const IpcIdSchema = z.string().min(1, 'ID must not be empty').max(256, 'ID too long')

export const IpcUrlSchema = z
  .string()
  .min(1, 'URL must not be empty')
  .refine(
    (val) => {
      const trimmed = val.trim()
      return (
        /^(https?:\/\/|magnet:\?)/i.test(trimmed) || /^(\/|[a-z]:\\).*\.torrent$/i.test(trimmed)
      )
    },
    { message: 'Invalid download source URL or torrent path' }
  )

export const ExportHistoryFormatSchema = z.enum(['csv', 'json']).optional()

export const TorrentFileSelectionSchema = z.array(z.number().int().nonnegative())

export const SetDownloadNetworkSchema = z.object({
  id: IpcIdSchema,
  networkId: z.string().min(1),
  enabled: z.boolean()
})

const BaseDownloadRequestSchema = z.object({
  url: z.string().min(1),
  destinationDir: z.string().min(1),
  suggestedFileName: z.string().min(1),
  totalBytes: z.number().int().nonnegative(),
  supportsRanges: z.boolean(),
  interfaceIds: z.array(z.string().min(1)),
  etag: z.string().nullable(),
  lastModified: z.string().nullable()
})

export const StartDownloadRequestSchema = z.discriminatedUnion('kind', [
  BaseDownloadRequestSchema.extend({
    kind: z.literal('http'),
    streamsPerNetwork: z.number().int().positive().optional(),
    browser: z
      .object({
        cookies: z.array(
          z.object({
            name: z.string(),
            value: z.string(),
            domain: z.string(),
            hostOnly: z.boolean(),
            path: z.string(),
            secure: z.boolean()
          })
        ),
        referer: z.string().optional(),
        userAgent: z.string().optional(),
        name: z.string().optional()
      })
      .optional()
  }),
  BaseDownloadRequestSchema.extend({
    kind: z.literal('torrent'),
    infoHash: z.string().min(1),
    selectedFiles: z.array(z.number().int().nonnegative()).optional()
  })
])

export const SecuritySettingsSchema = z.object({
  blockUnsafeExecutables: z.boolean().optional(),
  blockedExtensions: z.array(z.string().min(1).max(16)).optional(),
  scanDownloads: z.boolean().optional()
})

export const AppSettingsPatchSchema = z
  .object({
    themeSource: z.enum(['light', 'dark', 'system']).optional(),
    destinationDir: z.string().optional(),
    downloadsAtOnce: z.number().int().min(1).max(20).optional(),
    speedLimit: z.number().nonnegative().optional(),
    slowMode: z.boolean().optional(),
    slowModeSpeed: z.number().nonnegative().optional(),
    speedUnit: z.enum(['bytes', 'bits']).optional(),
    onboardingCompleted: z.boolean().optional(),
    security: SecuritySettingsSchema.optional(),
    downloadSchedule: z
      .object({
        enabled: z.boolean(),
        startMinute: z.number().int().min(0).max(1439),
        endMinute: z.number().int().min(0).max(1439),
        days: z.array(z.number().int().min(0).max(6)),
        endDate: z.string().optional()
      })
      .optional(),
    networkPreferences: z
      .record(
        z.string(),
        z.object({
          enabled: z.boolean().optional(),
          name: z.string().optional(),
          priority: z.number().optional(),
          speedLimit: z.number().optional(),
          dataLimit: z.any().optional(),
          monthlyLimit: z.number().optional(),
          monthlyUsage: z.number().optional()
        })
      )
      .optional()
  })
  .passthrough()

/**
 * Validates data against a Zod schema. If validation fails, throws a formatted Error.
 */
export function validateIpcPayload<T>(schema: z.ZodType<T>, data: unknown): T {
  const result = schema.safeParse(data)
  if (!result.success) {
    const errorDetails = result.error.issues
      .map((e) => `${e.path.join('.')}: ${e.message}`)
      .join(', ')
    throw new Error(`[IPC Validation Error] ${errorDetails}`)
  }
  return result.data
}

/**
 * IPC Error boundary wrapper. Intercepts exceptions and returns or rethrows clean errors.
 */
export async function withIpcErrorBoundary<T>(
  actionName: string,
  handler: () => Promise<T> | T
): Promise<T> {
  try {
    return await handler()
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    console.error(`[IPC Error] ${actionName} failed:`, message)
    throw new Error(message)
  }
}
