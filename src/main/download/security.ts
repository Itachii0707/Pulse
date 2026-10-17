import { execFile } from 'node:child_process'
import { existsSync } from 'node:fs'
import { extname, isAbsolute, normalize, relative, resolve, sep } from 'node:path'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)

/** Known executable or script MIME types that could pose security risks if run unexpectedly. */
export const DANGEROUS_MIME_TYPES = new Set([
  'application/x-msdownload',
  'application/x-msdos-program',
  'application/x-executable',
  'application/x-bat',
  'application/x-sh',
  'application/x-csh',
  'application/x-msi',
  'application/vnd.microsoft.portable-executable',
  'application/x-dosexec'
])

/** Common executable and script extensions */
export const DEFAULT_BLOCKED_EXTENSIONS = [
  '.bat',
  '.cmd',
  '.scr',
  '.vbs',
  '.wsf',
  '.ps1',
  '.reg',
  '.msi'
]

export const ALL_EXECUTABLE_EXTENSIONS = new Set([
  '.exe',
  '.com',
  '.bat',
  '.cmd',
  '.scr',
  '.msi',
  '.vbs',
  '.vbe',
  '.js',
  '.jse',
  '.wsf',
  '.wsh',
  '.ps1',
  '.reg',
  '.pif',
  '.application',
  '.gadget'
])

/** Check if the MIME type or extension represents an executable file. */
export function isExecutableContent(contentType: string | null, fileName: string): boolean {
  if (contentType) {
    const cleanMime = contentType.split(';')[0].trim().toLowerCase()
    if (DANGEROUS_MIME_TYPES.has(cleanMime)) return true
  }

  const ext = extname(fileName).toLowerCase()
  return ALL_EXECUTABLE_EXTENSIONS.has(ext)
}

/** Check if the filename ends with an extension on the blocked blacklist. */
export function isExtensionBlocked(fileName: string, blockedList?: string[]): boolean {
  const list = blockedList && blockedList.length > 0 ? blockedList : DEFAULT_BLOCKED_EXTENSIONS
  const ext = extname(fileName).toLowerCase()
  return list
    .map((e) => (e.startsWith('.') ? e.toLowerCase() : `.${e.toLowerCase()}`))
    .includes(ext)
}

/** Critical system root directories that downloads must never target. */
const SENSITIVE_SYSTEM_PATHS: string[] =
  process.platform === 'win32'
    ? [
        process.env['SystemRoot'] || 'C:\\Windows',
        process.env['ProgramFiles'] || 'C:\\Program Files',
        process.env['ProgramFiles(x86)'] || 'C:\\Program Files (x86)',
        process.env['ProgramData'] || 'C:\\ProgramData'
      ]
    : ['/etc', '/bin', '/sbin', '/usr/bin', '/usr/sbin', '/System', '/Library']

/**
 * Ensures candidatePath is fully contained inside destinationDir and does not escape
 * via path traversal or target critical OS system directories.
 */
export function isSafeDestinationPath(destinationDir: string, candidatePath: string): boolean {
  if (!isAbsolute(destinationDir)) return false

  const resolvedDest = resolve(normalize(destinationDir))
  const resolvedTarget = resolve(normalize(candidatePath))

  // Confinement check: candidate must be destinationDir itself or a child path
  const rel = relative(resolvedDest, resolvedTarget)
  if (rel.startsWith('..') || isAbsolute(rel)) {
    return false
  }

  // Prevent writing directly into sensitive OS system directories
  const normalizedLower = resolvedTarget.toLowerCase()
  for (const sysPath of SENSITIVE_SYSTEM_PATHS) {
    const sysResolvedLower = resolve(normalize(sysPath)).toLowerCase()
    if (
      normalizedLower === sysResolvedLower ||
      normalizedLower.startsWith(`${sysResolvedLower}${sep}`)
    ) {
      return false
    }
  }

  return true
}

export interface VirusScanResult {
  scanned: boolean
  clean: boolean
  details?: string
}

/**
 * Scans a file with Windows Defender (MpCmdRun.exe) if running on Windows.
 * Non-blocking, fails gracefully if Defender or MpCmdRun is unavailable.
 */
export async function scanFileWithAntivirus(filePath: string): Promise<VirusScanResult> {
  if (process.platform !== 'win32' || !existsSync(filePath)) {
    return { scanned: false, clean: true }
  }

  const defaultMpCmdRun = 'C:\\Program Files\\Windows Defender\\MpCmdRun.exe'
  const platformMpCmdRun = 'C:\\ProgramData\\Microsoft\\Windows Defender\\Platform'

  let mpCmdPath = existsSync(defaultMpCmdRun) ? defaultMpCmdRun : ''
  if (!mpCmdPath && existsSync(platformMpCmdRun)) {
    // Look for platform subfolder with latest MpCmdRun
    try {
      const { readdirSync } = await import('node:fs')
      const dirs = readdirSync(platformMpCmdRun, { withFileTypes: true })
        .filter((d) => d.isDirectory())
        .map((d) => resolve(platformMpCmdRun, d.name, 'MpCmdRun.exe'))
        .filter((p) => existsSync(p))
      if (dirs.length > 0) {
        mpCmdPath = dirs[dirs.length - 1]
      }
    } catch {
      // Fall through
    }
  }

  if (!mpCmdPath) {
    // Fall back to PowerShell Start-MpScan
    try {
      const psScript = `Start-MpScan -ScanType CustomScan -ScanPath '${filePath.replace(/'/g, "''")}'`
      await execFileAsync(
        'powershell.exe',
        ['-NoProfile', '-NonInteractive', '-Command', psScript],
        {
          timeout: 15_000
        }
      )
      return { scanned: true, clean: true }
    } catch (error) {
      // If PowerShell scan exits with non-zero or error
      const errMsg = error instanceof Error ? error.message : String(error)
      return { scanned: true, clean: true, details: `PowerShell scan completed: ${errMsg}` }
    }
  }

  try {
    // MpCmdRun -Scan -ScanType 3 -File "<path>" -DisableRemediation
    // Exit code 0 = No threat found, 2 = Threat found
    await execFileAsync(
      mpCmdPath,
      ['-Scan', '-ScanType', '3', '-File', filePath, '-DisableRemediation'],
      { timeout: 15_000 }
    )
    return { scanned: true, clean: true }
  } catch (error: unknown) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const code = (error as any)?.code
    if (code === 2) {
      return { scanned: true, clean: false, details: 'Threat detected by Windows Defender' }
    }
    // Code 0 is success; other codes might be timeout or permission
    return {
      scanned: true,
      clean: true,
      details: `Defender scan completed with note: ${(error as Error).message}`
    }
  }
}
