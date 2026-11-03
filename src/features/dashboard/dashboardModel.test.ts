import { describe, expect, it } from 'vitest'
import type { Alert, Camera, FarmEvent } from '../../types/domain'
import {
  bandHourMarks, bandPosition, cameraName, farmCondition, farmMinutes, onlineCameraCount, recentAlerts, restrictedSegments, sortAlerts, statusHeadline, weekDays,
} from './dashboardModel'

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
    expect(statusHeadline('warning', 1)).toBe('1 alerta abierta')
    expect(statusHeadline('critical', 3)).toBe('3 alertas abiertas')
  })

  it('puts open critical alerts first and acknowledged ones last', () => {
    const alert = (id: string, severity: Alert['severity'], status: Alert['status'], minutesAgo: number): Alert => ({
      id, eventId: null, cameraId: 'corral', kind: null, message: id, severity, status,
      createdAt: new Date(now.getTime() - minutesAgo * 60_000), acknowledgedAt: null, resolvedAt: null,
    })
    const sorted = sortAlerts([
      alert('ack-critical', 'critical', 'acknowledged', 1), alert('old-warning', 'warning', 'open', 30),
      alert('new-warning', 'warning', 'open', 2), alert('critical', 'critical', 'open', 40), alert('info', 'info', 'open', 1),
    ])
    expect(sorted.map(item => item.id)).toEqual(['critical', 'new-warning', 'old-warning', 'info', 'ack-critical'])
  })

  it('sums every camera into one point per minute', () => {
    const minute = (offset: number) => new Date(now.getTime() + offset * 60_000)
    const points = farmMinutes([
      { cameraId: 'b', minute: minute(1), inside: 3, outside: 1 },
      { cameraId: 'a', minute: minute(0), inside: 5, outside: 0 },
      { cameraId: 'b', minute: minute(0), inside: 2, outside: 1 },
    ])
    expect(points.map(({ inside, outside }) => [inside, outside])).toEqual([[7, 1], [3, 1]])
  })

  it('fills the week with quiet days', () => {
    const day = { day: '2026-10-03', total: 2, info: 0, warning: 1, critical: 1, open: 0, acknowledged: 0, resolved: 2 }
    const week = weekDays([day], now)
    expect(week.map(item => item.day)).toEqual(['2026-09-28', '2026-09-29', '2026-09-30', '2026-10-01', '2026-10-02', '2026-10-03', '2026-10-04'])
    expect(week[5]).toBe(day)
    expect(week[6].total).toBe(0)
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
