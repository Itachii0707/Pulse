import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_DOWNLOAD_SCHEDULE,
  localDate,
  scheduleMessage,
  scheduleTime,
  scheduleWindow,
  validSchedule
} from '../../../shared/downloadSchedule.ts'
import type { HttpBlockState } from '../../../shared/types.ts'
import {
  pickWork,
  type Requester,
  type SchedulerPolicy,
  type SchedulerState
} from '../scheduler.ts'

describe('scheduler.ts - request and window scheduling', () => {
  describe('downloadSchedule (shared)', () => {
    it('validates default download schedule', () => {
      assert.equal(validSchedule(DEFAULT_DOWNLOAD_SCHEDULE), true)
    })

    it('rejects malformed schedules', () => {
      assert.equal(validSchedule(null), false)
      assert.equal(validSchedule({}), false)
      assert.equal(validSchedule({ ...DEFAULT_DOWNLOAD_SCHEDULE, startMinute: 1500 }), false)
      assert.equal(
        validSchedule({ ...DEFAULT_DOWNLOAD_SCHEDULE, startMinute: 100, endMinute: 100 }),
        false
      )
      assert.equal(validSchedule({ ...DEFAULT_DOWNLOAD_SCHEDULE, days: [] }), false)
      assert.equal(validSchedule({ ...DEFAULT_DOWNLOAD_SCHEDULE, days: [7] }), false)
      assert.equal(validSchedule({ ...DEFAULT_DOWNLOAD_SCHEDULE, endDate: 'not-a-date' }), false)
    })

    it('formats localDate as YYYY-MM-DD', () => {
      const d = new Date(2026, 4, 15) // May 15, 2026
      assert.equal(localDate(d), '2026-05-15')
    })

    it('allows downloads when schedule is disabled', () => {
      const window = scheduleWindow({ ...DEFAULT_DOWNLOAD_SCHEDULE, enabled: false })
      assert.equal(window.allowed, true)
      assert.equal(scheduleMessage({ ...DEFAULT_DOWNLOAD_SCHEDULE, enabled: false }), null)
    })

    it('correctly calculates allowed window during active schedule', () => {
      // 00:00 to 07:00 every day
      const now = new Date(2026, 0, 1, 3, 30).getTime() // 3:30 AM
      const window = scheduleWindow(
        {
          enabled: true,
          startMinute: 0,
          endMinute: 7 * 60,
          days: [0, 1, 2, 3, 4, 5, 6]
        },
        now
      )
      assert.equal(window.allowed, true)
      assert.ok(window.endsAt && window.endsAt > now)
    })

    it('disallows downloads outside active schedule window and computes nextStart', () => {
      const now = new Date(2026, 0, 1, 12, 0).getTime() // 12:00 PM
      const window = scheduleWindow(
        {
          enabled: true,
          startMinute: 2 * 60, // 2:00 AM
          endMinute: 5 * 60, // 5:00 AM
          days: [0, 1, 2, 3, 4, 5, 6]
        },
        now
      )
      assert.equal(window.allowed, false)
      assert.ok(window.nextStart && window.nextStart > now)
    })

    it('formats schedule time strings cleanly', () => {
      const timeStr = scheduleTime(14 * 60 + 30) // 14:30
      assert.ok(timeStr.includes('2:30'))
    })
  })

  describe('pickWork (HTTP block scheduler)', () => {
    const policy: SchedulerPolicy = {
      hedgeAfterMs: 3000,
      maxHedgesPerBlock: 2,
      startupMs: 200
    }

    const makeBlock = (index: number, status: HttpBlockState['status']): HttpBlockState => ({
      kind: 'http',
      index,
      rangeStart: index * 1000,
      rangeEnd: (index + 1) * 1000 - 1,
      status,
      bytesDownloaded: 0,
      bytesByInterface: {}
    })

    it('assigns primary work when pending blocks exist', () => {
      const state: SchedulerState = {
        blocks: [makeBlock(0, 'downloading'), makeBlock(1, 'pending')],
        streams: [{ id: 1, interfaceId: 'eth0', status: 'pending', speedBytesPerSec: 100000 }],
        attempts: new Map([
          [0, [{ kind: 'primary', streamId: 2, networkId: 'wlan0', startedAt: 1000 }]]
        ]),
        avoid: new Map(),
        hedgesUsed: new Map()
      }
      const who: Requester = { id: 1, networkId: 'eth0', speedBytesPerSec: 100000 }
      const work = pickWork(state, who, 5000, policy)

      assert.ok(work)
      assert.equal(work.kind, 'primary')
      assert.equal(work.block.index, 1)
    })

    it('avoids assigning a block to a failing network if another network is free', () => {
      const state: SchedulerState = {
        blocks: [makeBlock(0, 'pending'), makeBlock(1, 'pending')],
        streams: [
          { id: 1, interfaceId: 'failing-net', status: 'pending', speedBytesPerSec: 10000 },
          { id: 2, interfaceId: 'good-net', status: 'pending', speedBytesPerSec: 100000 }
        ],
        attempts: new Map(),
        avoid: new Map([[0, 'failing-net']]),
        hedgesUsed: new Map()
      }
      const who: Requester = { id: 1, networkId: 'failing-net' }
      const work = pickWork(state, who, 1000, policy)

      assert.ok(work)
      assert.equal(work.block.index, 1) // Picked block 1 because block 0 avoids failing-net
    })

    it('returns undefined if disk is behind even if hedge candidate exists', () => {
      const state: SchedulerState = {
        blocks: [makeBlock(0, 'downloading')],
        streams: [{ id: 1, interfaceId: 'eth0', status: 'pending', speedBytesPerSec: 500000 }],
        attempts: new Map([
          [0, [{ kind: 'primary', streamId: 2, networkId: 'wlan0', startedAt: 1000 }]]
        ]),
        avoid: new Map(),
        hedgesUsed: new Map(),
        diskBehind: true
      }
      const who: Requester = { id: 1, networkId: 'eth0', speedBytesPerSec: 500000 }
      const work = pickWork(state, who, 10000, policy)

      assert.equal(work, undefined)
    })

    it('picks hedge candidate when no pending blocks exist and stream can finish much faster', () => {
      const state: SchedulerState = {
        blocks: [makeBlock(0, 'downloading')],
        streams: [
          { id: 2, interfaceId: 'slow-wlan', status: 'downloading', speedBytesPerSec: 100 },
          { id: 1, interfaceId: 'fast-eth', status: 'pending', speedBytesPerSec: 1_000_000 }
        ],
        attempts: new Map([
          [0, [{ kind: 'primary', streamId: 2, networkId: 'slow-wlan', startedAt: 1000 }]]
        ]),
        avoid: new Map(),
        hedgesUsed: new Map()
      }
      const who: Requester = { id: 1, networkId: 'fast-eth', speedBytesPerSec: 1_000_000 }
      // now = 10_000, attempt started at 1000 (> 3000ms ago)
      const work = pickWork(state, who, 10000, policy)

      assert.ok(work)
      assert.equal(work.kind, 'hedge')
      assert.equal(work.block.index, 0)
    })
  })
})
