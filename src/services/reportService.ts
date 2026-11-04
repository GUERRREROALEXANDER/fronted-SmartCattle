import { dataMode } from '../api/config'
import { getJson } from '../api/httpClient'
import { parseDailyReport } from '../api/parsers'
import { buildMockDailyReport } from '../mocks/mockData'
import type { ApiActivity } from '../types/api'
import type { DailyActivity, DailyReport, Sourced } from '../types/domain'
import { resolveSource } from './dataSource'
import { waitForMock, type ServiceOptions } from './options'

const timeZone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'America/Bogota'

const toActivity = (activity: ApiActivity): DailyActivity => ({
  observedMinutes: activity.observed_minutes, lyingMinutes: activity.lying_minutes, standingMinutes: activity.standing_minutes,
  walkingMinutes: activity.walking_minutes, peakCattle: activity.peak_cattle, peakPeople: activity.peak_people,
  minutesWithPeople: activity.minutes_with_people, lyingShare: activity.lying_share,
})

/** One calendar day of the herd, today unless a day is given (GET /api/reports/daily). */
export async function getDailyReport(options: ServiceOptions & { day?: string } = {}): Promise<Sourced<DailyReport>> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') {
    await waitForMock(options)
    return { data: buildMockDailyReport(options.day, options.now), source }
  }
  const report = parseDailyReport(await getJson<unknown>('/api/reports/daily', { ...options, query: { day: options.day, tz: timeZone() } }))
  return {
    data: {
      day: report.day, complete: report.complete, herd: toActivity(report.herd),
      notices: report.health.map(notice => ({ cameraId: notice.camera_id, kind: notice.kind, lyingShare: notice.lying_share })),
      alerts: {
        total: report.alerts.total, info: report.alerts.low, warning: report.alerts.medium, critical: report.alerts.high,
        open: report.alerts.open, acknowledged: report.alerts.acknowledged, resolved: report.alerts.resolved,
      },
      eventsTotal: report.events_total,
    },
    source,
  }
}
