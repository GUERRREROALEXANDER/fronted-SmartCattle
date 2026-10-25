import { describe, expect, it } from 'vitest'
import type { Camera, FarmEvent } from '../../types/domain'
import {
  byCamera, byHourOfDay, confidenceBuckets, dailyTrend, filterByRange, headlineKpis,
  shareByCategory, shareByKind, shareBySeverity,
} from './analyticsModel'

const now = new Date('2026-10-04T15:00:00')

function event(id: string, overrides: Partial<FarmEvent> = {}): FarmEvent {
  return {
    id,
    kind: 'cattle_out_of_zone',
    cameraId: 'camera-01',
    detectedObject: 'cow',
    confidence: 0.9,
    occurredAt: now,
    receivedAt: now,
    severity: 'warning',
    severitySource: 'catalog',
    ...overrides,
  }
}

function hoursAgo(hours: number, from = now): Date {
  return new Date(from.getTime() - hours * 3_600_000)
}

const cameras: Camera[] = [
  { id: 'camera-01', name: 'Corral Norte', location: '', status: 'online', lastSeenAt: null },
  { id: 'camera-02', name: 'Lote Oriental', location: '', status: 'online', lastSeenAt: null },
  { id: 'camera-03', name: 'Sin eventos', location: '', status: 'offline', lastSeenAt: null },
]

describe('filterByRange', () => {
  it('includes both boundaries and excludes future events', () => {
    const events = [
      event('start', { occurredAt: hoursAgo(24) }),
      event('inside', { occurredAt: hoursAgo(2) }),
      event('now'),
      event('old', { occurredAt: new Date(hoursAgo(24).getTime() - 1) }),
      event('future', { occurredAt: new Date(now.getTime() + 1) }),
    ]
    expect(filterByRange(events, '24h', now).map(item => item.id)).toEqual(['start', 'inside', 'now'])
  })

  it('applies the seven and thirty day windows', () => {
    const events = [
      event('36h', { occurredAt: hoursAgo(36) }),
      event('8d', { occurredAt: hoursAgo(8 * 24) }),
      event('31d', { occurredAt: hoursAgo(31 * 24) }),
    ]
    expect(filterByRange(events, '24h', now)).toEqual([])
    expect(filterByRange(events, '7d', now).map(item => item.id)).toEqual(['36h'])
    expect(filterByRange(events, '30d', now).map(item => item.id)).toEqual(['36h', '8d'])
  })
})

describe('event shares', () => {
  it('groups categories and preserves 100 percent with largest remainders', () => {
    const rows = shareByCategory([
      event('cattle'),
      event('security', { kind: 'person_detected' }),
      event('system', { kind: 'camera_disconnected' }),
    ])
    expect(rows.map(row => [row.category, row.count, row.percentage])).toEqual([
      ['cattle', 1, 34], ['security', 1, 33], ['system', 1, 33],
    ])
    expect(rows.reduce((sum, row) => sum + row.percentage, 0)).toBe(100)
  })

  it('groups kinds with their Spanish catalog labels', () => {
    const rows = shareByKind([
      event('a'), event('b'), event('c'),
      event('d', { kind: 'person_detected' }),
    ])
    const cattle = rows.find(row => row.kind === 'cattle_out_of_zone')
    const person = rows.find(row => row.kind === 'person_detected')
    expect(cattle).toMatchObject({ count: 3, percentage: 75, label: 'Animal fuera de la zona segura' })
    expect(person).toMatchObject({ count: 1, percentage: 25, label: 'Persona detectada' })
    expect(rows.reduce((sum, row) => sum + row.percentage, 0)).toBe(100)
  })

  it('groups severity in display order', () => {
    const rows = shareBySeverity([
      event('a', { severity: 'critical' }),
      event('b', { severity: 'info' }),
      event('c', { severity: 'info' }),
      event('d', { severity: 'warning' }),
    ])
    expect(rows.map(row => [row.severity, row.count, row.percentage])).toEqual([
      ['info', 2, 50], ['warning', 1, 25], ['critical', 1, 25],
    ])
  })

  it('returns stable zero shares when there are no events', () => {
    expect(shareByCategory([]).map(row => row.percentage)).toEqual([0, 0, 0])
    expect(shareByKind([])).toHaveLength(7)
    expect(shareBySeverity([]).map(row => row.count)).toEqual([0, 0, 0])
  })
})

describe('byCamera', () => {
  it('resolves names, includes unknown and zero-count cameras, and shares the total', () => {
    const rows = byCamera([
      event('a', { cameraId: 'camera-02' }),
      event('b', { cameraId: 'camera-02' }),
      event('c', { cameraId: 'camera-01' }),
      event('d', { cameraId: 'legacy-camera' }),
    ], cameras)
    expect(rows.map(row => [row.cameraId, row.count])).toEqual([
      ['camera-02', 2], ['camera-01', 1], ['legacy-camera', 1], ['camera-03', 0],
    ])
    expect(rows.find(row => row.cameraId === 'camera-02')?.name).toBe('Lote Oriental')
    expect(rows.find(row => row.cameraId === 'legacy-camera')?.name).toBe('legacy-camera')
    expect(rows.reduce((sum, row) => sum + row.percentage, 0)).toBe(100)
  })
})

describe('time distributions', () => {
  it('always returns 24 local hour buckets', () => {
    const rows = byHourOfDay([
      event('a', { occurredAt: new Date('2026-10-04T00:20:00') }),
      event('b', { occurredAt: new Date('2026-10-04T13:20:00') }),
      event('c', { occurredAt: new Date('2026-10-04T13:50:00') }),
    ])
    expect(rows).toHaveLength(24)
    expect(rows[0]).toMatchObject({ hour: 0, label: '00:00', count: 1 })
    expect(rows[13]).toMatchObject({ hour: 13, label: '13:00', count: 2 })
  })

  it('builds every local day touched by a rolling range and stacks categories', () => {
    const earlyNow = new Date('2026-10-04T01:30:00')
    const rows = dailyTrend([
      event('a', { occurredAt: new Date('2026-10-03T12:00:00') }),
      event('b', { kind: 'person_detected', occurredAt: new Date('2026-10-04T00:30:00') }),
      event('old', { occurredAt: new Date('2026-10-03T01:00:00') }),
    ], '24h', earlyNow)
    expect(rows.map(row => row.date)).toEqual(['2026-10-03', '2026-10-04'])
    expect(rows[0]).toMatchObject({ cattle: 1, security: 0, system: 0, total: 1 })
    expect(rows[1]).toMatchObject({ cattle: 0, security: 1, system: 0, total: 1 })
  })
})

describe('confidenceBuckets', () => {
  it('uses the documented boundaries and counts missing values separately', () => {
    const values: Array<number | null> = [0.49, 0.5, 0.69, 0.7, 0.84, 0.85, 1, null]
    const rows = confidenceBuckets(values.map((value, index) => event(String(index), { confidence: value })))
    expect(rows.map(row => [row.id, row.count])).toEqual([
      ['under50', 1], ['50to70', 2], ['70to85', 2], ['85to100', 2], ['unknown', 1],
    ])
    expect(rows.reduce((sum, row) => sum + row.percentage, 0)).toBe(100)
  })

  it('does not treat an invalid value as a measurement', () => {
    const rows = confidenceBuckets([event('invalid', { confidence: 1.5 })])
    expect(rows.find(row => row.id === 'unknown')?.count).toBe(1)
  })
})

describe('headlineKpis', () => {
  it('summarizes totals, key percentages and busiest distributions', () => {
    const events = [
      event('a', { cameraId: 'camera-02', occurredAt: new Date('2026-10-04T14:05:00') }),
      event('b', { cameraId: 'camera-02', occurredAt: new Date('2026-10-04T14:20:00') }),
      event('c', { cameraId: 'camera-02', occurredAt: new Date('2026-10-04T10:20:00') }),
      event('d', { kind: 'person_detected', severity: 'info', occurredAt: new Date('2026-10-04T14:40:00') }),
      event('e', { kind: 'ai_unavailable', severity: 'critical', occurredAt: new Date('2026-10-04T09:40:00') }),
    ]
    const result = headlineKpis(events, cameras)
    expect(result).toMatchObject({ totalEvents: 5, cattleOutOfZonePercentage: 60, criticalPercentage: 20 })
    expect(result.busiestHour).toMatchObject({ hour: 14, count: 3, percentage: 60 })
    expect(result.busiestCamera).toMatchObject({ cameraId: 'camera-02', name: 'Lote Oriental', count: 3, percentage: 60 })
  })

  it('does not invent busiest values for an empty range', () => {
    expect(headlineKpis([], cameras)).toEqual({
      totalEvents: 0,
      cattleOutOfZonePercentage: 0,
      criticalPercentage: 0,
      busiestHour: null,
      busiestCamera: null,
    })
  })
})
