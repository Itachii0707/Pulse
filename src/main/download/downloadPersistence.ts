import { readdir, readFile, rm, writeFile } from 'node:fs/promises'
import { join } from 'node:path'
import { app, safeStorage } from 'electron'
import type {
  BrowserContext,
  HttpDownloadState,
  StartDownloadRequest,
  TorrentDownloadState
} from '../../shared/types'
import { browserContextFrom } from './browserContext'
import { ensureDirectory } from './paths'
import type { SavedBlocks } from './savedProgress'

export interface PersistedDownloadBase {
  savedAt: number
  partialPath: string
  publicationPath?: string
  publicationIdentity?: { dev: number; ino: number }
  requestPayload: StartDownloadRequest
  /** Kept apart from requestPayload, sealed with OS keychain via safeStorage. */
  browser?: string
}

export type PersistedState =
  Omit<HttpDownloadState, 'blocks' | 'streams'> | Omit<TorrentDownloadState, 'pieces' | 'peers'>

export type PersistedDownload = PersistedDownloadBase & {
  version: 7
  state: PersistedState
} & SavedBlocks

export class DownloadPersistence {
  static downloadsRoot(): string {
    return join(app.getPath('userData'), 'downloads')
  }

  static downloadDir(id: string): string {
    return join(this.downloadsRoot(), id)
  }

  static manifestPath(id: string): string {
    return join(this.downloadDir(id), 'manifest.json')
  }

  static torrentFilePath(id: string): string {
    return join(this.downloadDir(id), 'metadata.torrent')
  }

  /**
   * Seals sensitive browser authentication context using safeStorage (DPAPI on Windows, Keychain on macOS).
   */
  static sealBrowser(browser: BrowserContext): string | undefined {
    if (!safeStorage.isEncryptionAvailable()) return undefined
    if (process.platform === 'linux' && safeStorage.getSelectedStorageBackend() === 'basic_text') {
      return undefined
    }
    try {
      return safeStorage.encryptString(JSON.stringify(browser)).toString('base64')
    } catch {
      return undefined
    }
  }

  /**
   * Unseals sealed browser credentials. Returns undefined if key is unavailable or decryption fails.
   */
  static unsealBrowser(sealed: string): BrowserContext | undefined {
    try {
      const decrypted = safeStorage.decryptString(Buffer.from(sealed, 'base64'))
      return browserContextFrom(JSON.parse(decrypted)) ?? undefined
    } catch {
      return undefined
    }
  }

  /**
   * Saves manifest to disk atomically.
   */
  static async saveManifest(id: string, persisted: PersistedDownload): Promise<void> {
    const dir = this.downloadDir(id)
    await ensureDirectory(dir)
    const filePath = this.manifestPath(id)
    await writeFile(filePath, JSON.stringify(persisted, null, 2), 'utf-8')
  }

  /**
   * Reads and parses a persisted download manifest, or returns null if missing or unreadable.
   */
  static async loadManifest(id: string): Promise<PersistedDownload | null> {
    try {
      const content = await readFile(this.manifestPath(id), 'utf-8')
      const parsed = JSON.parse(content) as PersistedDownload
      if (parsed && parsed.version === 7 && parsed.state) {
        return parsed
      }
      return null
    } catch {
      return null
    }
  }

  /**
   * Deletes a download's state directory.
   */
  static async removeManifestDir(id: string): Promise<void> {
    try {
      await rm(this.downloadDir(id), { recursive: true, force: true })
    } catch {
      // Ignore if already deleted
    }
  }

  /**
   * Cleans orphan download state directories that are no longer referenced.
   */
  static async cleanLeftovers(activeIds: Set<string>): Promise<void> {
    try {
      const root = this.downloadsRoot()
      const entries = await readdir(root, { withFileTypes: true })
      for (const entry of entries) {
        if (entry.isDirectory() && !activeIds.has(entry.name)) {
          await rm(join(root, entry.name), { recursive: true, force: true }).catch(() => {})
        }
      }
    } catch {
      // Best-effort cleanup
    }
  }
}
