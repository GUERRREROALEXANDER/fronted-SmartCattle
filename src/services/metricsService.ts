import { dataMode } from '../api/config'
import { getJson } from '../api/httpClient'
import { parseAlertReport, parseLiveMetrics, parseOccupancyHistory } from '../api/parsers'
import { buildMockAlertReport, buildMockLiveMetrics, buildMockOccupancyHistory } from '../mocks/mockData'
import type { AlertReport, LiveMetrics, OccupancySample, Sourced } from '../types/domain'
import { resolveSource } from './dataSource'
import { toLiveMetrics } from './mappers'
import { waitForMock, type ServiceOptions } from './options'

/** Farm-wide live counters (GET /api/metrics/live). */
export async function getLiveMetrics(options: ServiceOptions = {}): Promise<Sourced<LiveMetrics>> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') {
    await waitForMock(options)
    return { data: buildMockLiveMetrics(options.now), source }
  }
  return { data: toLiveMetrics(parseLiveMetrics(await getJson<unknown>('/api/metrics/live', options))), source }
}

export interface ReportWindow { start: Date; end: Date }

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota'

/** Head count per camera and minute (GET /api/reports/occupancy). */
export async function getOccupancyHistory(window: ReportWindow, options: ServiceOptions & { cameraId?: string } = {}): Promise<Sourced<OccupancySample[]>> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') {
    await waitForMock(options)
    return { data: buildMockOccupancyHistory(window.start, window.end), source }
  }
  const response = parseOccupancyHistory(await getJson<unknown>('/api/reports/occupancy', {
    ...options,
    query: { camera_id: options.cameraId, start: window.start.toISOString(), end: window.end.toISOString() },
  }))
  return {
    data: response.items.map(item => ({ cameraId: item.camera_id, minute: new Date(item.minute), inside: item.cattle_inside, outside: item.cattle_outside })),
    source,
  }
}

/** Alerts per day by severity and status, with handling times (GET /api/reports/alerts). */
export async function getAlertReport(window: ReportWindow, options: ServiceOptions = {}): Promise<Sourced<AlertReport>> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') {
    await waitForMock(options)
    return { data: buildMockAlertReport(window.start, window.end), source }
  }
  const report = parseAlertReport(await getJson<unknown>('/api/reports/alerts', {
    ...options,
    query: { start: window.start.toISOString(), end: window.end.toISOString(), tz: timeZone() },
  }))
  return {
    data: {
      days: report.days.map(day => ({
        day: day.day, total: day.total, info: day.low, warning: day.medium, critical: day.high,
        open: day.open, acknowledged: day.acknowledged, resolved: day.resolved,
      })),
      total: report.total, avgMinutesToAcknowledge: report.avg_minutes_to_acknowledge, avgMinutesToResolve: report.avg_minutes_to_resolve,
    },
    source,
  }
}
