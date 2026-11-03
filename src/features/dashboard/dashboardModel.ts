import type { Alert, AlertDay, Camera, FarmEvent, OccupancySample, Severity } from '../../types/domain'

const hour = 3_600_000
const severityRank: Record<Severity, number> = { info: 0, warning: 1, critical: 2 }

/** Open alerts first (critical on top), then the ones already acknowledged, newest first inside each group. */
export function sortAlerts(alerts: readonly Alert[]): Alert[] {
  return [...alerts].sort((a, b) =>
    Number(a.status !== 'open') - Number(b.status !== 'open')
    || severityRank[b.severity] - severityRank[a.severity]
    || b.createdAt.getTime() - a.createdAt.getTime())
}

export interface TrendPoint { at: number; label: string; inside: number; outside: number }

export const clock = (date: Date, seconds: boolean) =>
  date.toLocaleTimeString('es-CO', { hour: '2-digit', minute: '2-digit', ...(seconds ? { second: '2-digit' } : {}) })

/** The seven local days ending today, with zeros for days the report left out (a quiet day is still a day). */
export function weekDays(days: readonly AlertDay[], today: Date): AlertDay[] {
  const byDay = new Map(days.map(day => [day.day, day]))
  const result: AlertDay[] = []
  for (let offset = 6; offset >= 0; offset--) {
    const date = new Date(today.getFullYear(), today.getMonth(), today.getDate() - offset)
    const key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
    result.push(byDay.get(key) ?? { day: key, total: 0, info: 0, warning: 0, critical: 0, open: 0, acknowledged: 0, resolved: 0 })
  }
  return result
}

/** Per-camera minutes summed into one farm-wide line, oldest first. */
export function farmMinutes(samples: readonly OccupancySample[]): TrendPoint[] {
  const byMinute = new Map<number, TrendPoint>()
  for (const sample of samples) {
    const at = sample.minute.getTime()
    const point = byMinute.get(at) ?? { at, label: clock(sample.minute, false), inside: 0, outside: 0 }
    point.inside += sample.inside
    point.outside += sample.outside
    byMinute.set(at, point)
  }
  return [...byMinute.values()].sort((a, b) => a.at - b.at)
}

/** Warning or critical events in the last hour. The backend has no review state, so "recent" stands in for "active". */
export function recentAlerts(events: readonly FarmEvent[], now: Date, windowMs = hour): FarmEvent[] {
  return events
    .filter(event => severityRank[event.severity] >= severityRank.warning)
    .filter(event => now.getTime() - event.occurredAt.getTime() <= windowMs && event.occurredAt <= now)
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || b.occurredAt.getTime() - a.occurredAt.getTime())
}

export type FarmCondition = 'calm' | 'warning' | 'critical' | 'unknown'

/** Without event data the farm state is unknown: never report "all clear" by default. */
export function farmCondition(alerts: readonly { severity: Severity }[], hasEventData = true): FarmCondition {
  if (alerts.some(alert => alert.severity === 'critical')) return 'critical'
  if (alerts.length > 0) return 'warning'
  return hasEventData ? 'calm' : 'unknown'
}

export function statusHeadline(condition: FarmCondition, alertCount: number): string {
  if (condition === 'unknown') return 'Estado desconocido'
  if (condition === 'calm') return 'Todo en orden'
  return alertCount === 1 ? '1 alerta abierta' : `${alertCount} alertas abiertas`
}

export function onlineCameraCount(cameras: readonly Camera[]): number {
  return cameras.filter(camera => camera.status === 'online').length
}

export function cameraName(cameras: readonly Camera[] | null, cameraId: string): string {
  return cameras?.find(camera => camera.id === cameraId)?.name ?? cameraId
}

/** Position (0..1) of a moment inside the 24 h window that ends at `now`. Null when outside. */
export function bandPosition(date: Date, now: Date): number | null {
  const start = now.getTime() - 24 * hour
  const position = (date.getTime() - start) / (24 * hour)
  return position < 0 || position > 1 ? null : position
}

/** Labels at whole 6-hour marks (00:00, 06:00, 12:00, 18:00) inside the window, away from the "now" edge. */
export function bandHourMarks(now: Date): { key: string; position: number; label: string }[] {
  const marks = []
  const cursor = new Date(now.getTime() - 24 * hour)
  cursor.setMinutes(0, 0, 0)
  for (let step = 0; step <= 25; step++) {
    const position = bandPosition(cursor, now)
    if (position !== null && cursor.getHours() % 6 === 0 && position < 0.9) {
      marks.push({ key: cursor.toISOString(), position, label: `${String(cursor.getHours()).padStart(2, '0')}:00` })
    }
    cursor.setHours(cursor.getHours() + 1)
  }
  return marks
}

export interface BandSegment { start: number; end: number }

/**
 * Restricted-hour segments inside the 24 h window ending at `now`, as 0..1 ranges.
 * `from`/`to` are local hours and may wrap past midnight (e.g. 19 -> 5).
 */
export function restrictedSegments(now: Date, from: number, to: number): BandSegment[] {
  const windowStart = now.getTime() - 24 * hour
  const segments: BandSegment[] = []
  for (let dayOffset = -2; dayOffset <= 1; dayOffset++) {
    const begin = new Date(now)
    begin.setDate(begin.getDate() + dayOffset)
    begin.setHours(from, 0, 0, 0)
    const end = new Date(begin)
    if (to <= from) end.setDate(end.getDate() + 1)
    end.setHours(to, 0, 0, 0)
    const startPos = Math.max(0, (begin.getTime() - windowStart) / (24 * hour))
    const endPos = Math.min(1, (end.getTime() - windowStart) / (24 * hour))
    if (endPos > startPos) segments.push({ start: startPos, end: endPos })
  }
  return segments
}
