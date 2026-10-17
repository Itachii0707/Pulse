import test, { describe } from 'node:test'
import assert from 'node:assert/strict'
import { join } from 'node:path'
import { isExecutableContent, isExtensionBlocked, isSafeDestinationPath } from '../security.ts'
import { assertRateLimit, resetRateLimits } from '../../ipc/rateLimiter.ts'

describe('security.ts — Download Security & Path Validation', () => {
  describe('isExecutableContent', () => {
    test('detects executable MIME types regardless of extension', () => {
      assert.equal(isExecutableContent('application/x-msdownload', 'data.bin'), true)
      assert.equal(isExecutableContent('application/x-msdos-program', 'archive.dat'), true)
      assert.equal(isExecutableContent('application/x-executable', 'payload'), true)
      assert.equal(isExecutableContent('application/x-bat', 'script.txt'), true)
    })

    test('detects executable file extensions with generic or null MIME types', () => {
      assert.equal(isExecutableContent(null, 'installer.exe'), true)
      assert.equal(isExecutableContent('application/octet-stream', 'setup.msi'), true)
      assert.equal(isExecutableContent('text/plain', 'run.bat'), true)
      assert.equal(isExecutableContent(null, 'helper.vbs'), true)
      assert.equal(isExecutableContent(null, 'deploy.ps1'), true)
    })

    test('allows safe non-executable files and media', () => {
      assert.equal(isExecutableContent('application/pdf', 'document.pdf'), false)
      assert.equal(isExecutableContent('video/mp4', 'movie.mp4'), false)
      assert.equal(isExecutableContent('image/png', 'image.png'), false)
      assert.equal(isExecutableContent('application/zip', 'archive.zip'), false)
      assert.equal(isExecutableContent('text/plain', 'notes.txt'), false)
    })
  })

  describe('isExtensionBlocked', () => {
    test('blocks default dangerous script extensions', () => {
      assert.equal(isExtensionBlocked('script.bat'), true)
      assert.equal(isExtensionBlocked('command.cmd'), true)
      assert.equal(isExtensionBlocked('screensaver.scr'), true)
      assert.equal(isExtensionBlocked('visualbasic.vbs'), true)
      assert.equal(isExtensionBlocked('powershell.ps1'), true)
      assert.equal(isExtensionBlocked('registry.reg'), true)
    })

    test('allows standard archive, document, and media extensions', () => {
      assert.equal(isExtensionBlocked('archive.zip'), false)
      assert.equal(isExtensionBlocked('document.docx'), false)
      assert.equal(isExtensionBlocked('song.mp3'), false)
      assert.equal(isExtensionBlocked('linux.iso'), false)
    })

    test('honors custom user-provided blacklist', () => {
      const customBlocked = ['.iso', '.dmg', '.apk']
      assert.equal(isExtensionBlocked('disk.iso', customBlocked), true)
      assert.equal(isExtensionBlocked('mac.dmg', customBlocked), true)
      assert.equal(isExtensionBlocked('android.apk', customBlocked), true)
      assert.equal(isExtensionBlocked('script.bat', customBlocked), false)
    })
  })

  describe('isSafeDestinationPath', () => {
    const isWin = process.platform === 'win32'
    const baseDir = isWin ? 'C:\\Users\\PulseUser\\Downloads' : '/home/pulseuser/downloads'

    test('allows legitimate destination paths and subpaths', () => {
      assert.equal(isSafeDestinationPath(baseDir, baseDir), true)
      assert.equal(isSafeDestinationPath(baseDir, join(baseDir, 'file.zip')), true)
      assert.equal(isSafeDestinationPath(baseDir, join(baseDir, 'subfolder', 'file.mp4')), true)
    })

    test('rejects path traversal attempts that escape destination directory', () => {
      const malicious = isWin
        ? 'C:\\Users\\PulseUser\\Downloads\\..\\..\\Windows\\System32\\evil.exe'
        : '/home/pulseuser/downloads/../../etc/shadow'
      assert.equal(isSafeDestinationPath(baseDir, malicious), false)
    })

    test('rejects direct targeting of sensitive OS directories', () => {
      if (isWin) {
        assert.equal(isSafeDestinationPath('C:\\Windows', 'C:\\Windows\\system32\\cmd.exe'), false)
        assert.equal(
          isSafeDestinationPath('C:\\Program Files', 'C:\\Program Files\\app.exe'),
          false
        )
      } else {
        assert.equal(isSafeDestinationPath('/etc', '/etc/passwd'), false)
        assert.equal(isSafeDestinationPath('/bin', '/bin/sh'), false)
      }
    })

    test('rejects relative or non-absolute base directories', () => {
      assert.equal(isSafeDestinationPath('downloads', 'downloads/file.txt'), false)
      assert.equal(isSafeDestinationPath('./downloads', './downloads/file.txt'), false)
    })
  })

  describe('scanFileWithAntivirus', () => {
    test('returns scanned: false when target file does not exist', async () => {
      const { scanFileWithAntivirus } = await import('../security.ts')
      const result = await scanFileWithAntivirus('non-existent-pulse-test-file.tmp')
      assert.equal(result.scanned, false)
      assert.equal(result.clean, true)
    })
  })
})

describe('rateLimiter.ts — IPC Rate Limiting', () => {
  test('allows calls within quota and throttles excessive requests', () => {
    resetRateLimits()

    // clearHistory has a limit of 5 requests per 1000ms
    for (let i = 0; i < 5; i++) {
      assert.doesNotThrow(() => assertRateLimit('clearHistory'))
    }

    // 6th call should throw rate limit error
    assert.throws(() => assertRateLimit('clearHistory'), /\[IPC Rate Limit Exceeded\]/)

    // Resetting rate limits allows calls again
    resetRateLimits()
    assert.doesNotThrow(() => assertRateLimit('clearHistory'))
  })
})
