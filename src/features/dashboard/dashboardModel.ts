import type { Camera, FarmEvent, Severity } from '../../types/domain'

const hour = 3_600_000
const severityRank: Record<Severity, number> = { info: 0, warning: 1, critical: 2 }

/** Warning or critical events in the last hour. The backend has no review state, so "recent" stands in for "active". */
export function recentAlerts(events: readonly FarmEvent[], now: Date, windowMs = hour): FarmEvent[] {
  return events
    .filter(event => severityRank[event.severity] >= severityRank.warning)
    .filter(event => now.getTime() - event.occurredAt.getTime() <= windowMs && event.occurredAt <= now)
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity] || b.occurredAt.getTime() - a.occurredAt.getTime())
}

export type FarmCondition = 'calm' | 'warning' | 'critical' | 'unknown'

/** Without event data the farm state is unknown: never report "all clear" by default. */
export function farmCondition(alerts: readonly FarmEvent[], hasEventData = true): FarmCondition {
  if (alerts.some(alert => alert.severity === 'critical')) return 'critical'
  if (alerts.length > 0) return 'warning'
  return hasEventData ? 'calm' : 'unknown'
}

export function statusHeadline(condition: FarmCondition, alertCount: number): string {
  if (condition === 'unknown') return 'Estado desconocido'
  if (condition === 'calm') return 'Todo en orden'
  return alertCount === 1 ? '1 alerta en la última hora' : `${alertCount} alertas en la última hora`
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
