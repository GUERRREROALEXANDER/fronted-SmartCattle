import { dataMode } from '../api/config'
import { getJson } from '../api/httpClient'
import { parseEventsResponse } from '../api/validate'
import { buildMockFarmEvents } from '../mocks/mockData'
import type { EventKind, FarmEvent, Severity, Sourced } from '../types/domain'
import { resolveSource } from './dataSource'
import { toFarmEvent } from './mappers'
import { requestHeaders, waitForMock, type ServiceOptions } from './options'

/** The backend's severity vocabulary. The interface uses Severity. */
const levelBySeverity: Record<Severity, 'low' | 'medium' | 'high'> = {
  info: 'low',
  warning: 'medium',
  critical: 'high',
}

export interface EventFilters {
  cameraId?: string
  severity?: Severity
  kind?: EventKind
  /** Page size. The backend accepts 1 to 200 and defaults to 50. */
  limit?: number
  offset?: number
}

export interface EventPage {
  events: FarmEvent[]
  /** How many events match the filters, which is not how many came back. */
  total: number
}

function toQuery(filters: EventFilters): string {
  const params = new URLSearchParams()
  if (filters.cameraId) params.set('camera_id', filters.cameraId)
  if (filters.severity) params.set('level', levelBySeverity[filters.severity])
  if (filters.kind) params.set('event_type', filters.kind)
  if (filters.limit !== undefined) params.set('limit', String(filters.limit))
  if (filters.offset) params.set('offset', String(filters.offset))
  const query = params.toString()
  return query ? `?${query}` : ''
}

/** Sorts newest detection first, which is not the order the backend returns. */
function byDetectionTime(events: FarmEvent[]): FarmEvent[] {
  // The backend orders by arrival, because that is the clock it controls. The
  // interface shows detection time, so a late-arriving event must not jump
  // ahead of one detected after it.
  return [...events].sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
}

export async function listEvents(options: ServiceOptions = {}): Promise<Sourced<FarmEvent[]>> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') {
    await waitForMock(options)
    return { data: buildMockFarmEvents(options.now), source }
  }
  const response = parseEventsResponse(await getJson<unknown>('/api/events', options))
  return { data: byDetectionTime(response.items.map(toFarmEvent)), source }
}

/**
 * A filtered page of events.
 *
 * Separate from listEvents because it returns the match count alongside the
 * page: a caller paging on the page length cannot tell whether there is more,
 * and would stop one page early.
 *
 * In mock mode the filters are applied locally, so the events page behaves the
 * same way without a backend instead of appearing to ignore them.
 */
export async function listEventPage(
  filters: EventFilters = {},
  options: ServiceOptions = {},
): Promise<Sourced<EventPage>> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') {
    await waitForMock(options)
    const all = buildMockFarmEvents(options.now).filter(event =>
      (!filters.cameraId || event.cameraId === filters.cameraId)
      && (!filters.severity || event.severity === filters.severity)
      && (!filters.kind || event.kind === filters.kind))
    const offset = filters.offset ?? 0
    const limit = filters.limit ?? 50
    // Sliced after counting, so total is the number that matched.
    return { data: { events: all.slice(offset, offset + limit), total: all.length }, source }
  }
  const response = parseEventsResponse(
    await getJson<unknown>(`/api/events${toQuery(filters)}`, {
      ...options, headers: requestHeaders(options),
    }),
  )
  return {
    data: { events: byDetectionTime(response.items.map(toFarmEvent)), total: response.total },
    source,
  }
}
