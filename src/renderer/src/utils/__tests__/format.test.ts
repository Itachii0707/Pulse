import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  acceptedLink,
  describeFileCount,
  fileExtensionBadge,
  fileNameFromPath,
  formatBytes,
  formatDataUsage,
  formatEta,
  formatPercent,
  formatSpeed,
  formatSpeedLimit,
  formatSpeedOfLimit,
  pathInTorrent,
  sourceOf,
  speedTicks
} from '../format.ts'

describe('format.ts - renderer formatting utilities', () => {
  describe('formatBytes', () => {
    it('returns "0 B" for 0 or negative numbers or non-finite', () => {
      assert.equal(formatBytes(0), '0 B')
      assert.equal(formatBytes(-100), '0 B')
      assert.equal(formatBytes(NaN), '0 B')
      assert.equal(formatBytes(Infinity), '0 B')
    })

    it('formats exact byte and kilobyte quantities', () => {
      assert.equal(formatBytes(500), '500 B')
      assert.equal(formatBytes(1024), '1.0 KB')
      assert.equal(formatBytes(1536), '1.5 KB')
      assert.equal(formatBytes(1024 * 1024), '1.0 MB')
      assert.equal(formatBytes(1024 * 1024 * 1024), '1.0 GB')
      assert.equal(formatBytes(1024 ** 4), '1.0 TB')
    })
  })

  describe('formatSpeed', () => {
    it('formats in bytes mode', () => {
      assert.equal(formatSpeed(1024 * 1024, 'bytes'), '1.0 MB/s')
      assert.equal(formatSpeed(0, 'bytes'), '0 B/s')
    })

    it('formats in bits mode (thousand-based)', () => {
      // 1,000,000 bytes/s * 8 = 8,000,000 bits/s = 8.0 Mbps
      assert.equal(formatSpeed(1_000_000, 'bits'), '8.0 Mbps')
      assert.equal(formatSpeed(0, 'bits'), '0 bps')
    })
  })

  describe('speedTicks', () => {
    it('returns default single tick for zero or negative max', () => {
      const res = speedTicks(0, 'bytes')
      assert.equal(res.top, 1)
      assert.deepEqual(res.ticks, [])
    })

    it('returns spaced ticks and top speed for positive max', () => {
      const res = speedTicks(10 * 1024 * 1024, 'bytes')
      assert.ok(res.top >= 10 * 1024 * 1024)
      assert.ok(res.ticks.length >= 2)
      assert.ok(res.ticks[0].label.includes('MB/s'))
    })
  })

  describe('formatSpeedLimit', () => {
    it('rounds to whole numbers from 10 up', () => {
      // 10 MB/s
      assert.equal(formatSpeedLimit(10 * 1024 * 1024, 'bytes'), '10 MB/s')
      // 2.5 MB/s
      assert.equal(formatSpeedLimit(2.5 * 1024 * 1024, 'bytes'), '2.5 MB/s')
    })
  })

  describe('formatDataUsage', () => {
    it('formats used vs limit properly', () => {
      const res = formatDataUsage(10 * 1024 * 1024 * 1024, 50 * 1024 * 1024 * 1024)
      assert.equal(res, '10.0 of 50 GB')
    })
  })

  describe('formatSpeedOfLimit', () => {
    it('returns dash for 0 speed', () => {
      const [speed, max] = formatSpeedOfLimit(0, 10 * 1024 * 1024, 'bytes')
      assert.equal(speed, '—')
      assert.equal(max, '10 MB/s')
    })

    it('omits redundant unit when sharing same unit with limit', () => {
      const [speed, max] = formatSpeedOfLimit(8 * 1024 * 1024, 10 * 1024 * 1024, 'bytes')
      assert.equal(speed, '8.0')
      assert.equal(max, '10 MB/s')
    })
  })

  describe('formatEta', () => {
    it('returns dash for 0 or non-finite seconds', () => {
      assert.equal(formatEta(0), '—')
      assert.equal(formatEta(-5), '—')
      assert.equal(formatEta(Infinity), '—')
    })

    it('formats seconds, minutes, and hours', () => {
      assert.equal(formatEta(30), '30s')
      assert.equal(formatEta(90), '1m 30s')
      assert.equal(formatEta(3665), '1h 1m')
    })
  })

  describe('describeFileCount', () => {
    it('formats singular and plural file counts', () => {
      assert.equal(describeFileCount(1, 1), '1 file')
      assert.equal(describeFileCount(5, 5), '5 files')
      assert.equal(describeFileCount(2, 5), '2 of 5 files')
    })
  })

  describe('formatPercent', () => {
    it('handles boundaries correctly', () => {
      assert.equal(formatPercent(0, 100), 0)
      assert.equal(formatPercent(50, 100), 50)
      assert.equal(formatPercent(99.9, 100), 99) // Stays at 99 until truly done
      assert.equal(formatPercent(100, 100), 100)
      assert.equal(formatPercent(0, 0), 0)
    })
  })

  describe('path & file name helpers', () => {
    it('extracts filename from Windows and POSIX paths', () => {
      assert.equal(fileNameFromPath('C:\\Downloads\\archive.zip'), 'archive.zip')
      assert.equal(fileNameFromPath('/usr/local/bin/pulse'), 'pulse')
    })

    it('extracts fileExtensionBadge correctly', () => {
      assert.equal(fileExtensionBadge('document.pdf'), 'PDF')
      assert.equal(fileExtensionBadge('archive.tar.gz'), 'GZ')
      assert.equal(fileExtensionBadge('noextension'), 'FILE')
      assert.equal(fileExtensionBadge('.hidden'), 'FILE')
    })

    it('trims leading folder from torrent path', () => {
      assert.equal(pathInTorrent('Ubuntu-24.04/boot/vmlinuz'), 'boot/vmlinuz')
      assert.equal(pathInTorrent('standalone.iso'), 'standalone.iso')
    })
  })

  describe('acceptedLink and sourceOf', () => {
    it('accepts http, https, magnet, and torrent paths', () => {
      assert.equal(acceptedLink('https://example.com/file.iso'), 'https://example.com/file.iso')
      assert.equal(acceptedLink('http://example.com/file.iso'), 'http://example.com/file.iso')
      assert.equal(acceptedLink('magnet:?xt=urn:btih:abc'), 'magnet:?xt=urn:btih:abc')
      assert.equal(acceptedLink('C:\\Downloads\\ubuntu.torrent'), 'C:\\Downloads\\ubuntu.torrent')
      assert.equal(acceptedLink('/home/user/test.torrent'), '/home/user/test.torrent')
      assert.equal(acceptedLink('not a link'), null)
    })

    it('extracts source host safely', () => {
      assert.equal(sourceOf('https://speed.hetzner.de/100MB.bin'), 'speed.hetzner.de')
      assert.equal(sourceOf('not a url'), 'not a url')
    })
  })

  describe('additional format helpers', () => {
    it('formats duration correctly', async () => {
      const { formatDuration } = await import('../format.ts')
      assert.equal(formatDuration(0), '0:00')
      assert.equal(formatDuration(-10), '0:00')
      assert.equal(formatDuration(65), '1:05')
      assert.equal(formatDuration(3665), '1:01:05')
    })

    it('extracts dirnameOf safely', async () => {
      const { dirnameOf } = await import('../format.ts')
      assert.equal(dirnameOf('file.txt'), '.')
      assert.equal(dirnameOf('C:\\Downloads\\file.txt'), 'C:\\Downloads')
      assert.equal(dirnameOf('/usr/bin/pulse'), '/usr/bin')
    })

    it('formats relative timestamp formatWhen', async () => {
      const { formatWhen } = await import('../format.ts')
      const now = Date.now()
      assert.equal(formatWhen(now - 10_000, now), 'Just now')
      assert.equal(formatWhen(now - 120_000, now), '2 min ago')
    })

    it('filters networksInPlay', async () => {
      const { networksInPlay } = await import('../format.ts')
      const nets = [
        { id: '1', enabled: false, bytesDownloaded: 0 },
        { id: '2', enabled: true, bytesDownloaded: 0 },
        { id: '3', enabled: false, bytesDownloaded: 500 }
      ]
      const inPlay = networksInPlay(nets as unknown as Parameters<typeof networksInPlay>[0])
      assert.equal(inPlay.length, 2)
      assert.equal(inPlay[0].id, '2')
      assert.equal(inPlay[1].id, '3')
    })

    it('shortens toDisplayPath when matching homeDir', async () => {
      const { toDisplayPath } = await import('../format.ts')
      assert.ok(
        toDisplayPath('C:\\Users\\User\\Downloads', 'C:\\Users\\User') === '~\\Downloads' ||
          toDisplayPath('C:\\Users\\User\\Downloads', 'C:\\Users\\User') === '~/Downloads'
      )
      assert.equal(toDisplayPath('/home/user/downloads', '/home/user'), '~/downloads')
      assert.equal(toDisplayPath('D:\\Games', 'C:\\Users\\User'), 'D:\\Games')
    })
  })
})
