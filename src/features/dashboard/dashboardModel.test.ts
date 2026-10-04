import { describe, expect, it } from 'vitest'
import type { Camera, FarmEvent } from '../../types/domain'
import { bandHourMarks, bandPosition, cameraName, farmCondition, onlineCameraCount, recentAlerts, restrictedSegments, statusHeadline } from './dashboardModel'

const now = new Date('2026-10-04T15:00:00')
const event = (id: string, minutesAgo: number, severity: FarmEvent['severity']): FarmEvent => ({
  id, kind: 'cattle_out_of_zone', cameraId: 'corral', detectedObject: 'cow', confidence: 0.9,
  occurredAt: new Date(now.getTime() - minutesAgo * 60_000), receivedAt: now, severity, severitySource: 'catalog',
})

describe('dashboardModel', () => {
  it('keeps only warning/critical events from the last hour, critical first', () => {
    const alerts = recentAlerts([event('a', 10, 'warning'), event('b', 30, 'critical'), event('c', 5, 'info'), event('d', 90, 'critical')], now)
    expect(alerts.map(alert => alert.id)).toEqual(['b', 'a'])
  })

  it('derives the farm condition and headline', () => {
    expect(farmCondition([])).toBe('calm')
    expect(farmCondition([event('a', 1, 'warning')])).toBe('warning')
    expect(farmCondition([event('a', 1, 'warning'), event('b', 1, 'critical')])).toBe('critical')
    expect(farmCondition([], false)).toBe('unknown')
    expect(farmCondition([event('a', 1, 'critical')], false)).toBe('critical')
    expect(statusHeadline('unknown', 0)).toBe('Estado desconocido')
    expect(statusHeadline('calm', 0)).toBe('Todo en orden')
    expect(statusHeadline('warning', 1)).toBe('1 alerta en la última hora')
    expect(statusHeadline('critical', 3)).toBe('3 alertas en la última hora')
  })

  it('counts online cameras and resolves names', () => {
    const cameras: Camera[] = [
      { id: 'a', name: 'Corral', location: '', status: 'online', lastSeenAt: null },
      { id: 'b', name: 'Lote', location: '', status: 'offline', lastSeenAt: null },
    ]
    expect(onlineCameraCount(cameras)).toBe(1)
    expect(cameraName(cameras, 'a')).toBe('Corral')
    expect(cameraName(null, 'camera-01')).toBe('camera-01')
  })

  it('places dates on the 24 h band', () => {
    expect(bandPosition(now, now)).toBe(1)
    expect(bandPosition(new Date(now.getTime() - 12 * 3_600_000), now)).toBe(0.5)
    expect(bandPosition(new Date(now.getTime() - 25 * 3_600_000), now)).toBeNull()
  })

  it('labels whole 6-hour marks and leaves room for "Ahora"', () => {
    // Window 2026-10-03 15:00 -> 2026-10-04 15:00: marks at 18:00, 00:00, 06:00, 12:00.
    expect(bandHourMarks(now).map(mark => mark.label)).toEqual(['18:00', '00:00', '06:00', '12:00'])
    expect(bandHourMarks(new Date('2026-10-04T12:30:00')).map(mark => mark.label)).toEqual(['18:00', '00:00', '06:00'])
  })

  it('computes restricted segments that wrap past midnight', () => {
    // Window: yesterday 15:00 -> today 15:00. Restricted 19:00 -> 05:00 = yesterday 19:00 -> today 05:00.
    const segments = restrictedSegments(now, 19, 5)
    expect(segments).toHaveLength(1)
    expect(segments[0].start).toBeCloseTo(4 / 24)
    expect(segments[0].end).toBeCloseTo(14 / 24)
  })
})
