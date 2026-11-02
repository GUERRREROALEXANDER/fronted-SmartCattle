import { dataMode } from '../api/config'
import { getJson, postJson } from '../api/httpClient'
import { parseAlert, parseAlertsResponse } from '../api/parsers'
import { buildMockAlerts } from '../mocks/mockData'
import type { Alert, AlertStatus, Severity, Sourced } from '../types/domain'
import { resolveSource } from './dataSource'
import { toAlert } from './mappers'
import { waitForMock, type ServiceOptions } from './options'

export interface AlertQuery {
  status?: AlertStatus
  severity?: Severity
  cameraId?: string
  limit?: number
}

const severityLevel: Record<Severity, string> = { info: 'low', warning: 'medium', critical: 'high' }

// Demo alerts live in memory so acknowledging and resolving behave like the backend in mock mode.
let mockAlerts: Alert[] | null = null
function demoAlerts(now: Date): Alert[] {
  return (mockAlerts ??= buildMockAlerts(now))
}

/** Security alerts, newest first (GET /api/alerts). */
export async function listAlerts(query: AlertQuery = {}, options: ServiceOptions = {}): Promise<Sourced<Alert[]>> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') {
    await waitForMock(options)
    const items = demoAlerts(options.now ?? new Date()).filter(alert =>
      (!query.status || alert.status === query.status) && (!query.severity || alert.severity === query.severity) &&
      (!query.cameraId || alert.cameraId === query.cameraId))
    return { data: items.slice(0, query.limit ?? 50).map(alert => ({ ...alert })), source }
  }
  const response = parseAlertsResponse(await getJson<unknown>('/api/alerts', {
    ...options,
    query: {
      status: query.status, severity: query.severity && severityLevel[query.severity], camera_id: query.cameraId,
      limit: query.limit ?? 50,
    },
  }))
  return { data: response.items.map(toAlert), source }
}

async function transition(id: string, action: 'acknowledge' | 'resolve', options: ServiceOptions): Promise<Alert> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') {
    await waitForMock(options)
    const alert = demoAlerts(options.now ?? new Date()).find(item => item.id === id)
    if (!alert) throw new Error(`Unknown alert ${id}`)
    const at = new Date()
    if (action === 'acknowledge' && alert.status === 'open') Object.assign(alert, { status: 'acknowledged', acknowledgedAt: at })
    if (action === 'resolve' && alert.status !== 'resolved') Object.assign(alert, { status: 'resolved', resolvedAt: at })
    return { ...alert }
  }
  return toAlert(parseAlert(await postJson<unknown>(`/api/alerts/${encodeURIComponent(id)}/${action}`, undefined, options)))
}

/** Open → acknowledged: someone is looking into it. */
export const acknowledgeAlert = (id: string, options: ServiceOptions = {}) => transition(id, 'acknowledge', options)

/** Open or acknowledged → resolved, also how a false alarm is dismissed. */
export const resolveAlert = (id: string, options: ServiceOptions = {}) => transition(id, 'resolve', options)
