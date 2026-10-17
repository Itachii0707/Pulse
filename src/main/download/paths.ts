import * as electron from 'electron'
import { lstat, mkdir, open, rm, stat } from 'node:fs/promises'
import { basename, extname, join } from 'node:path'
import { isSafeDestinationPath } from './security'
import { markSparse } from './sparseFile'

export { isSafeDestinationPath }

const electronApp =
  (electron as unknown as { app?: typeof electron.app }).app ??
  (electron as unknown as { default?: { app?: typeof electron.app } }).default?.app

export function getDefaultDownloadsDir(): string {
  if (electronApp?.getPath) return electronApp.getPath('downloads')
  return join(process.env.USERPROFILE || process.env.HOME || '', 'Downloads')
}

export function getHomeDir(): string {
  if (electronApp?.getPath) return electronApp.getPath('home')
  return process.env.USERPROFILE || process.env.HOME || ''
}

// Somewhere to stop rather than spin forever if every candidate is taken
// (or if something outside the app is creating them as fast as we try).
const MAX_NAME_ATTEMPTS = 10_000

// Longer than any real extension. Past this, what follows the last dot is part of a title
// ("St. Louis Cardinals vs Chicago Cubs full game replay…"), shortened along with the rest.
const MAX_EXTENSION_BYTES = 32

export async function pathExists(path: string): Promise<boolean> {
  try {
    await lstat(path)
    return true
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') return false
    throw error
  }
}

function sanitizeFileName(fileName: string): string {
  // A server-provided name is one component, never a path or NTFS data stream.
  let safe = fileName.replace(/[\\/]/g, '_').replace(/\p{Cc}/gu, '_')
  if (process.platform === 'win32') {
    safe = safe.replace(/[<>:"|?*]/g, '_').replace(/[ .]+$/, '')
    if (/^(con|prn|aux|nul|com[1-9¹²³]|lpt[1-9¹²³])(?:\.|$)/i.test(safe)) safe = `_${safe}`
  }
  return !safe || /^\.+$/.test(safe) ? 'download' : safe
}

export async function ensureDirectory(directory: string): Promise<void> {
  try {
    await mkdir(directory, { recursive: true })
  } catch (error) {
    // Windows throws EPERM when trying to mkdir a drive root
    if ((error as NodeJS.ErrnoException).code === 'EPERM') {
      const stats = await stat(directory).catch(() => null)
      if (stats?.isDirectory()) return
    }
    throw error
  }
}

/**
 * The first of `name`, `name (1)`, `name (2)`… in `directory` that is free and that `claim` takes
 * for this download: `claim` returns false to pass on a name, and an EEXIST it throws does too.
 * `suffix` is what claiming adds to a name, room left for it within the 255-byte component limit.
 */
async function claimName(
  directory: string,
  name: string,
  { suffix, extension }: { suffix: string; extension: boolean },
  claim: (candidate: string) => Promise<boolean>
): Promise<string> {
  const targetCheck = join(directory, name)
  if (!isSafeDestinationPath(directory, targetCheck)) {
    throw new Error(`Insecure destination path rejected: ${directory}`)
  }
  await ensureDirectory(directory)
  name = sanitizeFileName(name)
  let ext = extension ? extname(name) : ''
  if (Buffer.byteLength(ext) > MAX_EXTENSION_BYTES) ext = ''
  const maxBaseBytes = 255 - Buffer.byteLength(` (9999)${suffix}`) - Buffer.byteLength(ext)
  const baseCharacters = Array.from(ext ? basename(name, ext) : name)
  while (Buffer.byteLength(baseCharacters.join('')) > maxBaseBytes) baseCharacters.pop()
  const base = baseCharacters.join('')

  for (let counter = 0; counter < MAX_NAME_ATTEMPTS; counter += 1) {
    const candidate =
      counter === 0
        ? join(directory, `${base}${ext}`)
        : join(directory, `${base} (${counter})${ext}`)
    if (await pathExists(candidate)) continue
    try {
      if (await claim(candidate)) return candidate
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'EEXIST') throw error
    }
  }

  throw new Error(`Could not find an unused file name for "${name}" in ${directory}`)
}

/**
 * Claims a download by exclusively creating <final name>.plexo. The final name
 * itself does not appear until the file is complete. An existing partial file
 * also claims its corresponding final name, including after a restart.
 */
export async function reserveDestinationPath(directory: string, fileName: string): Promise<string> {
  return claimName(
    directory,
    fileName,
    { suffix: '.plexo', extension: true },
    async (candidate) => {
      const handle = await open(`${candidate}.plexo`, 'wx+')
      await handle.close()
      if (!(await pathExists(candidate))) {
        await markSparse(`${candidate}.plexo`)
        return true
      }
      await rm(`${candidate}.plexo`)
      return false
    }
  )
}

/**
 * Claims the final name itself, by exclusively creating it empty: a torrent is written in place,
 * as torrent clients do, so what's there from the start is its folder (or its one file). Being
 * new, it's this download's alone, never something already in the destination.
 */
export async function claimDestinationPath(
  directory: string,
  name: string,
  folder: boolean
): Promise<string> {
  // A folder's name has no extension to keep last: "Show.S01" goes to "Show.S01 (1)".
  return claimName(directory, name, { suffix: '', extension: !folder }, async (candidate) => {
    if (folder) await mkdir(candidate)
    else await (await open(candidate, 'wx')).close()
    return true
  })
}
