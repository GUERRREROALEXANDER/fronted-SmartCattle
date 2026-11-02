import { describe, expect, it } from 'vitest'
import type { Animal } from '../../types/domain'
import { STALE_AFTER_HOURS, countHerd, hoursSinceSeen, needsAttention } from './herdModel'

const NOW = new Date('2026-10-29T12:00:00Z')
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000)

const animal = (over: Partial<Animal> & { tag: string }): Animal => ({
  name: null, status: 'active', cameraId: null, lastDetection: hoursAgo(1),
  createdAt: hoursAgo(1000), updatedAt: hoursAgo(1), ...over,
})

describe('countHerd', () => {
  it('counts an empty herd', () => {
    expect(countHerd([], NOW)).toEqual({
      total: 0, active: 0, lost: 0, inactive: 0, neverSeen: 0, stale: 0,
    })
  })

  it('counts each status', () => {
    const counts = countHerd([
      animal({ tag: 'A-1' }),
      animal({ tag: 'A-2' }),
      animal({ tag: 'A-3', status: 'lost' }),
      animal({ tag: 'A-4', status: 'inactive' }),
    ], NOW)
    expect(counts).toMatchObject({ total: 4, active: 2, lost: 1, inactive: 1 })
  })

  it('separates never seen from seen long ago', () => {
    // Two different problems: one animal was registered and has never been
    // detected, the other was detected and then stopped being.
    const counts = countHerd([
      animal({ tag: 'A-1', lastDetection: null }),
      animal({ tag: 'A-2', lastDetection: hoursAgo(STALE_AFTER_HOURS + 1) }),
      animal({ tag: 'A-3', lastDetection: hoursAgo(1) }),
    ], NOW)
    expect(counts.neverSeen).toBe(1)
    expect(counts.stale).toBe(1)
  })

  it('does not count an inactive animal as unseen', () => {
    // An inactive animal is not expected to be anywhere, so reporting it as
    // missing is noise that hides the animals that are.
    const counts = countHerd([
      animal({ tag: 'A-1', status: 'inactive', lastDetection: null }),
      animal({ tag: 'A-2', status: 'inactive', lastDetection: hoursAgo(500) }),
    ], NOW)
    expect(counts.neverSeen).toBe(0)
    expect(counts.stale).toBe(0)
  })

  it('treats the threshold as not yet stale', () => {
    // Exactly at the boundary is still fine; one second past is not. A
    // threshold tested on one side only passes when it is off by one.
    expect(countHerd([animal({ tag: 'A-1', lastDetection: hoursAgo(STALE_AFTER_HOURS) })], NOW).stale)
      .toBe(0)
    expect(countHerd([animal({ tag: 'A-1', lastDetection: hoursAgo(STALE_AFTER_HOURS + 0.01) })], NOW).stale)
      .toBe(1)
  })
})

describe('needsAttention', () => {
  it('is empty for a healthy herd', () => {
    expect(needsAttention([animal({ tag: 'A-1' }), animal({ tag: 'A-2' })], NOW)).toEqual([])
  })

  it('puts a lost animal first, then never seen, then stale', () => {
    const rows = needsAttention([
      animal({ tag: 'stale', lastDetection: hoursAgo(50) }),
      animal({ tag: 'never', lastDetection: null }),
      animal({ tag: 'lost', status: 'lost' }),
      animal({ tag: 'fine' }),
    ], NOW)
    // Ordered by how much the farm should worry. Sorting by tag would bury all
    // three among the healthy rows.
    expect(rows.map(row => row.tag)).toEqual(['lost', 'never', 'stale'])
  })

  it('leaves out inactive animals', () => {
    const rows = needsAttention([animal({ tag: 'gone', status: 'inactive', lastDetection: null })], NOW)
    expect(rows).toEqual([])
  })

  it('puts the one unseen longest first within a group', () => {
    const rows = needsAttention([
      animal({ tag: 'recent', lastDetection: hoursAgo(30) }),
      animal({ tag: 'older', lastDetection: hoursAgo(100) }),
    ], NOW)
    expect(rows.map(row => row.tag)).toEqual(['older', 'recent'])
  })
})

describe('hoursSinceSeen', () => {
  it('measures the gap', () => {
    expect(hoursSinceSeen(animal({ tag: 'A-1', lastDetection: hoursAgo(3) }), NOW)).toBeCloseTo(3)
  })

  it('is null when never seen, not a huge number', () => {
    // Returning something like Infinity would render as a duration and read
    // as a measurement rather than as an absence.
    expect(hoursSinceSeen(animal({ tag: 'A-1', lastDetection: null }), NOW)).toBeNull()
  })
})
