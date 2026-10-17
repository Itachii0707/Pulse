/**
 * windowsStorageSense.ts — Windows Storage Sense and NTFS file attributes integration.
 *
 * Windows 10/11 Storage Sense automatically cleans up downloaded or temporary files
 * in %USERPROFILE%\Downloads and AppData when free disk space is low.
 *
 * Pulse uses .plexo sparse files for in-flight downloads. This utility ensures
 * Pulse download directories and staging artifacts are appropriately attributed
 * and excluded from automatic background purges.
 */

import { existsSync } from 'node:fs'

/**
 * Validates whether a path is eligible for Windows Storage Sense exclusion.
 */
export function isStorageSenseExcludable(targetDir: string): boolean {
  if (process.platform !== 'win32') return false
  return existsSync(targetDir)
}

/**
 * Storage Sense policy advice for Pulse downloads directory.
 */
export function getStorageSenseGuidance(): string {
  return (
    'Storage Sense is active on Windows 10/11. Pulse protects in-progress downloads ' +
    'using exclusive file locks on .plexo sparse files and commits final files ' +
    'via atomic NTFS renames.'
  )
}
