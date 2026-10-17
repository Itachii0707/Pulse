/**
 * rateLimiter.ts — IPC rate-limiting mechanism to guard against renderer loops or DoS attacks.
 */

interface RateLimitConfig {
  maxRequests: number
  windowMs: number
}

const DEFAULT_CONFIG: RateLimitConfig = {
  maxRequests: 60,
  windowMs: 1000
}

const CHANNEL_LIMITS: Record<string, RateLimitConfig> = {
  updateSettings: { maxRequests: 10, windowMs: 1000 },
  startDownload: { maxRequests: 15, windowMs: 1000 },
  clearHistory: { maxRequests: 5, windowMs: 1000 },
  exportHistory: { maxRequests: 5, windowMs: 1000 },
  probeUrl: { maxRequests: 20, windowMs: 1000 },
  chooseDestinationFolder: { maxRequests: 10, windowMs: 1000 },
  chooseTorrentFile: { maxRequests: 10, windowMs: 1000 }
}

const requestTimestamps = new Map<string, number[]>()

/**
 * Checks whether an IPC invocation is within rate limits.
 * If exceeded, throws an Error describing the limit.
 */
export function assertRateLimit(channel: string): void {
  const config = CHANNEL_LIMITS[channel] ?? DEFAULT_CONFIG
  const now = Date.now()
  const cutoff = now - config.windowMs

  let timestamps = requestTimestamps.get(channel)
  if (!timestamps) {
    timestamps = []
    requestTimestamps.set(channel, timestamps)
  }

  // Purge old entries
  while (timestamps.length > 0 && timestamps[0] <= cutoff) {
    timestamps.shift()
  }

  if (timestamps.length >= config.maxRequests) {
    throw new Error(
      `[IPC Rate Limit Exceeded] Too many requests on channel "${channel}" (${timestamps.length}/${config.maxRequests} per ${config.windowMs}ms).`
    )
  }

  timestamps.push(now)
}

/** Reset rate limit records (useful for unit tests). */
export function resetRateLimits(): void {
  requestTimestamps.clear()
}
