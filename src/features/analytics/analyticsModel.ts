import { eventCatalog, severityLabel } from '../../lib/eventCatalog'
import type { Camera, EventCategory, EventKind, FarmEvent, Severity } from '../../types/domain'
import { largestRemainderPercentages, percentageOf } from './percent'

export type AnalyticsRange = '24h' | '7d' | '30d'
export type ConfidenceBucketId = 'under50' | '50to70' | '70to85' | '85to100' | 'unknown'

export interface CategoryShare {
  category: EventCategory
  label: string
  count: number
  percentage: number
}
export interface KindShare {
  kind: EventKind
  label: string
  count: number
  percentage: number
}
export interface SeverityShare {
  severity: Severity
  label: string
  count: number
  percentage: number
}
export interface CameraShare {
  cameraId: string
  name: string
  count: number
  percentage: number
}
export interface HourShare {
  hour: number
  label: string
  count: number
}
export interface DailyShare {
  date: string
  label: string
  cattle: number
  security: number
  system: number
  total: number
}
export interface ConfidenceShare {
  id: ConfidenceBucketId
  label: string
  shortLabel: string
  count: number
  percentage: number
}
export interface HeadlineKpis {
  totalEvents: number
  cattleOutOfZonePercentage: number
  criticalPercentage: number
  busiestHour: (HourShare & { percentage: number }) | null
  busiestCamera: CameraShare | null
}

export const categoryLabels: Record<EventCategory, string> = {
  cattle: 'Ganado',
  security: 'Seguridad',
  system: 'Sistema',
}

const categories: readonly EventCategory[] = ['cattle', 'security', 'system']
const severities: readonly Severity[] = ['info', 'warning', 'critical']
const kinds = Object.keys(eventCatalog) as EventKind[]
const rangeDuration: Record<AnalyticsRange, number> = {
  '24h': 24 * 3_600_000,
  '7d': 7 * 24 * 3_600_000,
  '30d': 30 * 24 * 3_600_000,
}
const dayFormatter = new Intl.DateTimeFormat('es-CO', { day: 'numeric', month: 'short' })
const confidenceDefinitions: readonly Omit<ConfidenceShare, 'count' | 'percentage'>[] = [
  { id: 'under50', label: 'Menos de 50 %', shortLabel: '<50' },
  { id: '50to70', label: '50–70 %', shortLabel: '50–70' },
  { id: '70to85', label: '70–85 %', shortLabel: '70–85' },
  { id: '85to100', label: '85–100 %', shortLabel: '85–100' },
  { id: 'unknown', label: 'Sin dato', shortLabel: 'N/D' },
]

function withPercentages<T extends { count: number }>(rows: readonly T[]): Array<T & { percentage: number }> {
  const percentages = largestRemainderPercentages(rows.map(row => row.count))
  return rows.map((row, index) => ({ ...row, percentage: percentages[index] }))
}

function localDayKey(date: Date): string {
  const year = date.getFullYear()
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

function confidenceBucket(confidence: number | null): ConfidenceBucketId {
  if (confidence === null || !Number.isFinite(confidence)) return 'unknown'
  const value = confidence * 100
  if (value < 0 || value > 100) return 'unknown'
  if (value < 50) return 'under50'
  if (value < 70) return '50to70'
  if (value < 85) return '70to85'
  return '85to100'
}

export function filterByRange(events: readonly FarmEvent[], range: AnalyticsRange, now: Date): FarmEvent[] {
  const start = now.getTime() - rangeDuration[range]
  return events.filter(event => {
    const timestamp = event.occurredAt.getTime()
    return timestamp >= start && timestamp <= now.getTime()
  })
}

export function shareByCategory(events: readonly FarmEvent[]): CategoryShare[] {
  const rows = categories.map(category => ({
    category,
    label: categoryLabels[category],
    count: events.filter(event => eventCatalog[event.kind].category === category).length,
  }))
  return withPercentages(rows)
}

export function shareByKind(events: readonly FarmEvent[]): KindShare[] {
  const rows = kinds.map(kind => ({
    kind,
    label: eventCatalog[kind].label,
    count: events.filter(event => event.kind === kind).length,
  }))
  return withPercentages(rows)
}

export function shareBySeverity(events: readonly FarmEvent[]): SeverityShare[] {
  const rows = severities.map(severity => ({
    severity,
    label: severityLabel[severity],
    count: events.filter(event => event.severity === severity).length,
  }))
  return withPercentages(rows)
}

export function byCamera(events: readonly FarmEvent[], cameras: readonly Camera[]): CameraShare[] {
  const rows = new Map<string, { cameraId: string; name: string; count: number }>()
  for (const camera of cameras) rows.set(camera.id, { cameraId: camera.id, name: camera.name, count: 0 })
  for (const event of events) {
    const row = rows.get(event.cameraId) ?? { cameraId: event.cameraId, name: event.cameraId, count: 0 }
    row.count += 1
    rows.set(event.cameraId, row)
  }
  return withPercentages([...rows.values()])
    .sort((a, b) => b.count - a.count || a.name.localeCompare(b.name, 'es'))
}

export function byHourOfDay(events: readonly FarmEvent[]): HourShare[] {
  const counts = Array.from({ length: 24 }, () => 0)
  for (const event of events) counts[event.occurredAt.getHours()] += 1
  return counts.map((count, hour) => ({ hour, label: `${String(hour).padStart(2, '0')}:00`, count }))
}

export function dailyTrend(events: readonly FarmEvent[], range: AnalyticsRange, now: Date): DailyShare[] {
  const start = new Date(now.getTime() - rangeDuration[range])
  const cursor = new Date(start)
  cursor.setHours(0, 0, 0, 0)
  const rows: DailyShare[] = []
  const byDay = new Map<string, DailyShare>()

  while (cursor.getTime() <= now.getTime()) {
    const date = localDayKey(cursor)
    const row: DailyShare = { date, label: dayFormatter.format(cursor), cattle: 0, security: 0, system: 0, total: 0 }
    rows.push(row)
    byDay.set(date, row)
    cursor.setDate(cursor.getDate() + 1)
  }

  for (const event of filterByRange(events, range, now)) {
    const row = byDay.get(localDayKey(event.occurredAt))
    if (!row) continue
    row[eventCatalog[event.kind].category] += 1
    row.total += 1
  }
  return rows
}

export function confidenceBuckets(events: readonly FarmEvent[]): ConfidenceShare[] {
  const rows = confidenceDefinitions.map(definition => ({ ...definition, count: 0 }))
  const byId = new Map(rows.map(row => [row.id, row]))
  for (const event of events) {
    const id = confidenceBucket(event.confidence)
    const row = byId.get(id)
    if (row) row.count += 1
  }
  return withPercentages(rows)
}

export function headlineKpis(events: readonly FarmEvent[], cameras: readonly Camera[]): HeadlineKpis {
  const hours = byHourOfDay(events)
  const busiestHour = events.length > 0
    ? hours.reduce((busiest, hour) => hour.count > busiest.count ? hour : busiest, hours[0])
    : null
  const cameraRows = byCamera(events, cameras)
  const cattleOutOfZone = shareByKind(events).find(row => row.kind === 'cattle_out_of_zone')?.count ?? 0

  return {
    totalEvents: events.length,
    cattleOutOfZonePercentage: percentageOf(cattleOutOfZone, events.length),
    criticalPercentage: percentageOf(events.filter(event => event.severity === 'critical').length, events.length),
    busiestHour: busiestHour ? { ...busiestHour, percentage: percentageOf(busiestHour.count, events.length) } : null,
    busiestCamera: events.length > 0 ? cameraRows[0] : null,
  }
}

export function buildAnalyticsModel(events: readonly FarmEvent[], cameras: readonly Camera[], range: AnalyticsRange, now: Date) {
  const filtered = filterByRange(events, range, now)
  return {
    events: filtered,
    categories: shareByCategory(filtered),
    kinds: shareByKind(filtered),
    severities: shareBySeverity(filtered),
    cameras: byCamera(filtered, cameras),
    hours: byHourOfDay(filtered),
    days: dailyTrend(filtered, range, now),
    confidence: confidenceBuckets(filtered),
    kpis: headlineKpis(filtered, cameras),
  }
}
