import { afterEach, describe, expect, it, vi } from 'vitest'
import { parseDailyReport, parseNotificationSettings, parseNotificationTest } from '../api/parsers'
import { getDailyReport } from './reportService'
import { getNotificationSettings, saveNotificationSettings } from './notificationService'

const report = {
  day: '2026-11-03', time_zone: 'America/Bogota', start: '2026-11-03T05:00:00Z', end: '2026-11-04T05:00:00Z', complete: false,
  generated_at: '2026-11-03T20:00:00Z', events_total: 2, cameras: [],
  herd: {
    observed_minutes: 300, lying_minutes: 500, standing_minutes: 400, walking_minutes: 100, unknown_posture_minutes: 0,
    peak_cattle: 9, peak_people: 1, minutes_with_people: 4, lying_share: 0.5,
  },
  health: [{ camera_id: 'cam-1', kind: 'prolonged_lying', lying_share: 0.9, observed_minutes: 300, message: 'x' }],
  alerts: { total: 3, low: 1, medium: 1, high: 1, open: 1, acknowledged: 1, resolved: 1 },
}

afterEach(() => vi.unstubAllGlobals())

function stubFetch(body: unknown) {
  const fetchMock = vi.fn<(url: string, init?: RequestInit) => Promise<Response>>(async () => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }))
  vi.stubGlobal('fetch', fetchMock)
  return fetchMock
}

describe('parseDailyReport', () => {
  it('reads what the backend sends', () => {
    expect(parseDailyReport(report).herd.peak_cattle).toBe(9)
  })

  it('keeps a day with no posture as unknown rather than zero', () => {
    expect(parseDailyReport({ ...report, herd: { ...report.herd, lying_share: null } }).herd.lying_share).toBeNull()
  })

  it('leaves out a notice this version does not know, and keeps the rest', () => {
    const parsed = parseDailyReport({ ...report, health: [...report.health, { camera_id: 'c', kind: 'new_kind', lying_share: 0.1 }] })
    expect(parsed.health.map(item => item.kind)).toEqual(['prolonged_lying'])
  })

  it.each([
    [{ ...report, day: 'hoy' }],
    [{ ...report, herd: { ...report.herd, peak_cattle: -1 } }],
    [{ ...report, alerts: { ...report.alerts, open: '1' } }],
    [null],
  ])('rejects a body off the contract', body => {
    expect(() => parseDailyReport(body)).toThrow()
  })
})

describe('notification parsers', () => {
  it('ignores a channel this version does not know', () => {
    const parsed = parseNotificationSettings({ enabled: true, whatsapp_phone: null, telegram_chat_id: '1', min_severity: 'high', channels_available: ['telegram', 'pigeon'] })
    expect(parsed.channels_available).toEqual(['telegram'])
  })

  it('rejects an unknown result status', () => {
    expect(() => parseNotificationTest({ results: [{ channel: 'telegram', status: 'maybe' }] })).toThrow()
  })
})

describe('services against the backend', () => {
  it('asks for the given day in the browser time zone and renames for the screens', async () => {
    const fetchMock = stubFetch(report)
    const { data } = await getDailyReport({ day: '2026-11-03', mode: 'api' })
    const url = new URL(String(fetchMock.mock.calls[0]![0]), 'http://x')
    expect(url.pathname).toBe('/api/reports/daily')
    expect(url.searchParams.get('day')).toBe('2026-11-03')
    expect(url.searchParams.get('tz')).toBeTruthy()
    expect(data?.herd.lyingShare).toBe(0.5)
    expect(data?.alerts.critical).toBe(1)
    expect(data?.notices).toEqual([{ cameraId: 'cam-1', kind: 'prolonged_lying', lyingShare: 0.9 }])
  })

  it('translates the severity both ways for the settings', async () => {
    const answer = { enabled: true, whatsapp_phone: '+573001234567', telegram_chat_id: null, min_severity: 'high', channels_available: ['whatsapp'] }
    const fetchMock = stubFetch(answer)
    expect((await getNotificationSettings({ mode: 'api' })).data?.minSeverity).toBe('critical')
    const saved = await saveNotificationSettings({ enabled: true, whatsappPhone: '+573001234567', telegramChatId: null, minSeverity: 'critical' }, { mode: 'api' })
    expect(saved.channelsAvailable).toEqual(['whatsapp'])
    const init = fetchMock.mock.calls[1]![1]!
    expect(init.method).toBe('PUT')
    expect(JSON.parse(String(init.body))).toEqual({ enabled: true, whatsapp_phone: '+573001234567', telegram_chat_id: null, min_severity: 'high' })
  })
})
