import { eventCatalog } from '../../lib/eventCatalog'
import type { EventCategory, FarmEvent, Severity } from '../../types/domain'

export type CategoryTab = 'all' | EventCategory
export type Period = 'today' | '24h' | '7d' | 'all'
export type SeverityFilter = 'all' | 'warning' | 'critical'

export interface EventFilters {
  tab: CategoryTab
  period: Period
  cameraId: string | null
  severity: SeverityFilter
}

export const defaultFilters: EventFilters = { tab: 'all', period: 'all', cameraId: null, severity: 'all' }

const rank: Record<Severity, number> = { info: 0, warning: 1, critical: 2 }
const day = 86_400_000

function startOfDay(date: Date): Date {
  const start = new Date(date)
  start.setHours(0, 0, 0, 0)
  return start
}

function periodStart(period: Period, now: Date): number {
  if (period === 'today') return startOfDay(now).getTime()
  if (period === '24h') return now.getTime() - day
  if (period === '7d') return now.getTime() - 7 * day
  return -Infinity
}

/** Everything is filtered on the client: the backend returns the latest 1000 events without query options. */
export function filterEvents(events: readonly FarmEvent[], filters: EventFilters, now: Date): FarmEvent[] {
  const since = periodStart(filters.period, now)
  return events.filter(event =>
    (filters.tab === 'all' || eventCatalog[event.kind].category === filters.tab)
    && event.occurredAt.getTime() >= since
    && (filters.cameraId === null || event.cameraId === filters.cameraId)
    && (filters.severity === 'all' || rank[event.severity] >= rank[filters.severity]))
}

export function countByCategory(events: readonly FarmEvent[]): Record<CategoryTab, number> {
  const counts: Record<CategoryTab, number> = { all: events.length, cattle: 0, security: 0, system: 0 }
  for (const event of events) counts[eventCatalog[event.kind].category]++
  return counts
}

export interface DayGroup { key: string; label: string; events: FarmEvent[] }

const dateLabel = new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' })

/** Groups newest-first events by local day: "Hoy", "Ayer", then the full date. */
export function groupByDay(events: readonly FarmEvent[], now: Date): DayGroup[] {
  const today = startOfDay(now).getTime()
  const groups = new Map<string, DayGroup>()
  for (const event of events) {
    const start = startOfDay(event.occurredAt)
    const key = start.toISOString()
    if (!groups.has(key)) {
      const diff = Math.round((today - start.getTime()) / day)
      const label = diff === 0 ? 'Hoy' : diff === 1 ? 'Ayer' : capitalize(dateLabel.format(start))
      groups.set(key, { key, label, events: [] })
    }
    groups.get(key)!.events.push(event)
  }
  return [...groups.values()]
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)

/** Whether a local time falls inside restricted hours that may wrap past midnight (e.g. 19 -> 5). */
export function isRestrictedTime(date: Date, from: number, to: number): boolean {
  const hour = date.getHours() + date.getMinutes() / 60
  return from <= to ? hour >= from && hour < to : hour >= from || hour < to
}

export function hasActiveFilters(filters: EventFilters): boolean {
  return filters.period !== 'all' || filters.cameraId !== null || filters.severity !== 'all'
}
