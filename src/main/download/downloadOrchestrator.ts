import type { StartDownloadRequest } from '../../shared/types'

export interface DownloadLifecycleHost {
  start(requestPayload: StartDownloadRequest): Promise<string>
  pause(id: string, scheduleStopping?: boolean): Promise<void>
  resume(id: string): void
  relink(id: string, url: string, auth?: unknown): Promise<void>
  cancel(id: string): Promise<void>
  remove(id: string, trashFile?: boolean): Promise<void>
  setNetworkEnabled(id: string, networkId: string, enabled: boolean): Promise<void>
}

/**
 * DownloadOrchestrator coordinates high-level lifecycle commands, ensuring state transitions
 * follow strict invariant rules and error boundaries.
 */
export class DownloadOrchestrator {
  constructor(private readonly host: DownloadLifecycleHost) {}

  async startDownload(requestPayload: StartDownloadRequest): Promise<string> {
    return this.host.start(requestPayload)
  }

  async pauseDownload(id: string, scheduleStopping?: boolean): Promise<void> {
    await this.host.pause(id, scheduleStopping)
  }

  resumeDownload(id: string): void {
    this.host.resume(id)
  }

  async relinkDownload(id: string, url: string, auth?: unknown): Promise<void> {
    await this.host.relink(id, url, auth)
  }

  async cancelDownload(id: string): Promise<void> {
    await this.host.cancel(id)
  }

  async removeDownload(id: string, trashFile?: boolean): Promise<void> {
    await this.host.remove(id, trashFile)
  }

  async setNetworkEnabled(id: string, networkId: string, enabled: boolean): Promise<void> {
    await this.host.setNetworkEnabled(id, networkId, enabled)
  }
}
