import { scheduleWindow } from '../../shared/downloadSchedule'
import { DOWNLOADS_AT_ONCE, type DownloadSchedule } from '../../shared/types'

export interface SchedulableDownload {
  state: {
    status: string
    queuedAt?: number
    scheduled?: boolean
    pausedAt?: number
  }
  scheduleStopping?: boolean
}

export class DownloadScheduler {
  private downloadsAtOnce: number = DOWNLOADS_AT_ONCE.default
  private downloadSchedule?: DownloadSchedule
  private scheduleLoaded = false

  constructor(downloadsAtOnce = DOWNLOADS_AT_ONCE.default, schedule?: DownloadSchedule) {
    this.downloadsAtOnce = downloadsAtOnce
    this.downloadSchedule = schedule
  }

  setDownloadsAtOnce(count: number): void {
    this.downloadsAtOnce = Math.max(1, Math.min(20, count))
  }

  getDownloadsAtOnce(): number {
    return this.downloadsAtOnce
  }

  setSchedule(schedule?: DownloadSchedule): void {
    this.downloadSchedule = schedule
    this.scheduleLoaded = true
  }

  getSchedule(): DownloadSchedule | undefined {
    return this.downloadSchedule
  }

  markScheduleLoaded(): void {
    this.scheduleLoaded = true
  }

  isScheduleLoaded(): boolean {
    return this.scheduleLoaded
  }

  /**
   * Checks whether the schedule window currently allows active downloads.
   */
  scheduleAllowsDownloads(now = Date.now()): boolean {
    if (!this.scheduleLoaded) return false
    return scheduleWindow(this.downloadSchedule, now).allowed
  }

  /**
   * Checks whether additional downloads may be started based on running concurrency limit.
   */
  canStartMore(runningCount: number): boolean {
    return runningCount < this.downloadsAtOnce
  }

  /**
   * Sorts queued items oldest first.
   */
  sortQueued<T extends SchedulableDownload>(queued: T[]): T[] {
    return queued.sort((a, b) => (a.state.queuedAt ?? 0) - (b.state.queuedAt ?? 0))
  }

  /**
   * Calculates the queuedAt timestamp for placing an item at the front or back of the queue.
   */
  calculateQueuedAt(existingQueuedTimes: number[], front: boolean, now = Date.now()): number {
    if (existingQueuedTimes.length === 0) return now
    return front
      ? Math.min(now, ...existingQueuedTimes) - 1
      : Math.max(now, ...existingQueuedTimes.map((place) => place + 1))
  }

  /**
   * Computes the millisecond duration until the next schedule transition (start or end).
   */
  getNextScheduleTransitionDelay(now = Date.now()): number {
    if (!this.downloadSchedule?.enabled) return 1000
    const window = scheduleWindow(this.downloadSchedule, now)
    const boundary = window.allowed ? window.endsAt : window.nextStart
    return boundary ? Math.max(1, Math.min(1000, boundary - now)) : 1000
  }
}
