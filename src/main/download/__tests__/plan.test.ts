import assert from 'node:assert/strict'
import { describe, it } from 'node:test'
import {
  DEFAULT_MAX_BLOCK_BYTES,
  interleave,
  MAX_STREAMS_PER_NETWORK,
  MIN_BLOCK_BYTES,
  planBlocks,
  planDownload,
  planPieces,
  START_STREAMS_PER_NETWORK,
  startingStreams
} from '../plan.ts'

describe('plan.ts - download block and piece planning', () => {
  describe('interleave', () => {
    it('returns empty array when input is empty', () => {
      assert.deepEqual(
        interleave([], () => 'group'),
        []
      )
    })

    it('interleaves items from different groups preserving relative order', () => {
      const items = [
        { group: 'A', id: 1 },
        { group: 'A', id: 2 },
        { group: 'B', id: 3 },
        { group: 'B', id: 4 },
        { group: 'C', id: 5 }
      ]
      const result = interleave(items, (item) => item.group)
      assert.deepEqual(
        result.map((i) => `${i.group}-${i.id}`),
        ['A-1', 'B-3', 'C-5', 'A-2', 'B-4']
      )
    })
  })

  describe('planDownload', () => {
    it('returns a single unsplit block when splittable is false', () => {
      const plan = planDownload({
        totalBytes: 50 * 1024 * 1024,
        splittable: false,
        networkCount: 2
      })
      assert.equal(plan.blockCount, 1)
      assert.equal(plan.blockSizeBytes, 50 * 1024 * 1024)
    })

    it('returns a single block for zero or negative totalBytes', () => {
      const plan = planDownload({
        totalBytes: 0,
        splittable: true,
        networkCount: 1
      })
      assert.equal(plan.blockCount, 1)
      assert.equal(plan.blockSizeBytes, 0)
    })

    it('clamps block size to MIN_BLOCK_BYTES for small files', () => {
      const plan = planDownload({
        totalBytes: 500 * 1024, // 500 KB < MIN_BLOCK_BYTES
        splittable: true,
        networkCount: 1
      })
      assert.equal(plan.blockSizeBytes, MIN_BLOCK_BYTES)
      assert.equal(plan.blockCount, 1)
    })

    it('clamps block size to DEFAULT_MAX_BLOCK_BYTES for large files', () => {
      const plan = planDownload({
        totalBytes: 10 * 1024 * 1024 * 1024, // 10 GB
        splittable: true,
        networkCount: 1
      })
      assert.equal(plan.blockSizeBytes, DEFAULT_MAX_BLOCK_BYTES)
      assert.equal(plan.blockCount, Math.ceil((10 * 1024 * 1024 * 1024) / DEFAULT_MAX_BLOCK_BYTES))
    })

    it('respects custom maxBlockBytes override', () => {
      const customMax = 2 * 1024 * 1024 // 2 MB
      const plan = planDownload({
        totalBytes: 200 * 1024 * 1024,
        splittable: true,
        networkCount: 1,
        maxBlockBytes: customMax
      })
      assert.equal(plan.blockSizeBytes, customMax)
      assert.equal(plan.blockCount, 100)
    })
  })

  describe('startingStreams', () => {
    it('never returns fewer than 1 stream even with 0 waiting blocks', () => {
      const streams = startingStreams(0, 1)
      assert.equal(streams, 1)
    })

    it('returns default START_STREAMS_PER_NETWORK when plenty of blocks are waiting', () => {
      const streams = startingStreams(100, 2)
      assert.equal(streams, START_STREAMS_PER_NETWORK)
    })

    it('scales down when fewer blocks are waiting than requested streams', () => {
      const streams = startingStreams(4, 2, 8)
      // perNetwork = ceil(4 / 2) = 2
      assert.equal(streams, 2)
    })

    it('clamps to MAX_STREAMS_PER_NETWORK if requested is excessive', () => {
      const streams = startingStreams(1000, 1, 100)
      assert.equal(streams, MAX_STREAMS_PER_NETWORK)
    })
  })

  describe('planBlocks', () => {
    it('creates an open-ended block when totalBytes <= 0', () => {
      const blocks = planBlocks(0, MIN_BLOCK_BYTES)
      assert.equal(blocks.length, 1)
      assert.equal(blocks[0].rangeStart, 0)
      assert.equal(blocks[0].rangeEnd, null)
      assert.equal(blocks[0].status, 'pending')
    })

    it('creates accurate non-overlapping contiguous blocks', () => {
      const totalBytes = 25 * 1024 * 1024 // 25 MB
      const blockSize = 10 * 1024 * 1024 // 10 MB
      const blocks = planBlocks(totalBytes, blockSize)

      assert.equal(blocks.length, 3)
      assert.equal(blocks[0].rangeStart, 0)
      assert.equal(blocks[0].rangeEnd, 10 * 1024 * 1024 - 1)

      assert.equal(blocks[1].rangeStart, 10 * 1024 * 1024)
      assert.equal(blocks[1].rangeEnd, 20 * 1024 * 1024 - 1)

      assert.equal(blocks[2].rangeStart, 20 * 1024 * 1024)
      assert.equal(blocks[2].rangeEnd, 25 * 1024 * 1024 - 1)
    })
  })

  describe('planPieces', () => {
    it('returns empty array if totalBytes or pieceLength is invalid', () => {
      assert.deepEqual(planPieces(0, 1024), [])
      assert.deepEqual(planPieces(1024, 0), [])
    })

    it('plans torrent pieces with provisional bytes initialized to 0', () => {
      const pieces = planPieces(5000, 2000)
      assert.equal(pieces.length, 3)
      assert.equal(pieces[0].rangeStart, 0)
      assert.equal(pieces[0].rangeEnd, 1999)
      assert.equal(pieces[0].provisionalBytes, 0)
      assert.equal(pieces[2].rangeStart, 4000)
      assert.equal(pieces[2].rangeEnd, 4999)
    })
  })
})
