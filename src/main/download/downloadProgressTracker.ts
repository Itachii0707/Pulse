import { SPEED_HISTORY_SECONDS, type DownloadState } from '../../shared/types'

/** The peak speed is the best speed held over this many seconds. */
export const PEAK_SAMPLE_SECONDS = 5

export interface PeakReading {
  time: number
  bytes: number
}

export interface ProgressTrackerTarget {
  state: DownloadState
  peakReadings: PeakReading[]
}

export class DownloadProgressTracker {
  /**
   * Adds each network's speed to the download's history, and 0 for one no longer listed.
   * Ensures history windows are aligned and bounded to SPEED_HISTORY_SECONDS.
   */
  static sampleSpeeds(state: DownloadState): void {
    const history = (state.speedHistory ??= {})
    const length = Object.values(history)[0]?.length ?? 0
    for (const network of state.networks) {
      history[network.id] ??= new Array<number>(length).fill(0)
    }
    for (const [id, series] of Object.entries(history)) {
      series.push(state.networks.find((network) => network.id === id)?.speedBytesPerSec ?? 0)
      if (series.length > SPEED_HISTORY_SECONDS) series.shift()
    }
  }

  /**
   * Raises the peak to the last PEAK_SAMPLE_SECONDS of downloading, read from the bytes themselves.
   */
  static samplePeak(target: ProgressTrackerTarget, now: number): void {
    const { state, peakReadings: readings } = target
    readings.push({ time: now, bytes: state.bytesDownloaded })

    // Back to newest reading at least PEAK_SAMPLE_SECONDS old
    while (readings.length > 1 && readings[1].time <= now - PEAK_SAMPLE_SECONDS * 1000) {
      readings.shift()
    }

    const first = readings[0]
    if (!first || now - first.time < PEAK_SAMPLE_SECONDS * 1000) return

    const timeDiffSec = (now - first.time) / 1000
    if (timeDiffSec <= 0) return

    const held = (state.bytesDownloaded - first.bytes) / timeDiffSec
    const downloadingSec = (now - state.startedAt - (state.totalPausedMs ?? 0)) / 1000
    const average =
      downloadingSec >= PEAK_SAMPLE_SECONDS ? state.bytesDownloaded / downloadingSec : 0

    state.peakSpeedBytesPerSec = Math.max(state.peakSpeedBytesPerSec ?? 0, held, average)
  }

  /**
   * Calculates estimated time remaining in seconds, or null if speed is 0 or progress unknown.
   */
  static calculateEta(
    totalBytes: number,
    bytesDownloaded: number,
    speedBytesPerSec: number
  ): number | null {
    if (speedBytesPerSec <= 0 || totalBytes <= 0 || bytesDownloaded >= totalBytes) {
      return null
    }
    const remaining = totalBytes - bytesDownloaded
    return Math.max(0, Math.round(remaining / speedBytesPerSec))
  }
}
