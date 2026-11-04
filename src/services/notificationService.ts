import { dataMode } from '../api/config'
import { getJson, postJson, putJson } from '../api/httpClient'
import { parseNotificationSettings, parseNotificationTest } from '../api/parsers'
import type { ApiEventLevel } from '../types/api'
import type { NotificationChannel, NotificationSettings, NotificationTestResult, Severity, Sourced } from '../types/domain'
import { resolveSource } from './dataSource'
import { waitForMock, type ServiceOptions } from './options'

const toLevel: Record<Severity, ApiEventLevel> = { info: 'low', warning: 'medium', critical: 'high' }
const toSeverity: Record<ApiEventLevel, Severity> = { low: 'info', medium: 'warning', high: 'critical' }

// The demo mode has no server to send anything: it remembers the form and says no channel is available.
let mockSettings: NotificationSettings = { enabled: true, whatsappPhone: null, telegramChatId: null, minSeverity: 'warning', channelsAvailable: [] }

function toSettings(body: unknown): NotificationSettings {
  const parsed = parseNotificationSettings(body)
  return {
    enabled: parsed.enabled, whatsappPhone: parsed.whatsapp_phone, telegramChatId: parsed.telegram_chat_id,
    minSeverity: toSeverity[parsed.min_severity], channelsAvailable: parsed.channels_available,
  }
}

/** Where this account wants its alerts (GET /api/notifications/settings). */
export async function getNotificationSettings(options: ServiceOptions = {}): Promise<Sourced<NotificationSettings>> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') {
    await waitForMock(options)
    return { data: mockSettings, source }
  }
  return { data: toSettings(await getJson<unknown>('/api/notifications/settings', options)), source }
}

export type NotificationChoice = Omit<NotificationSettings, 'channelsAvailable'>

export async function saveNotificationSettings(choice: NotificationChoice, options: ServiceOptions = {}): Promise<NotificationSettings> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') {
    await waitForMock(options)
    mockSettings = { ...choice, channelsAvailable: [] }
    return mockSettings
  }
  return toSettings(await putJson<unknown>('/api/notifications/settings', {
    enabled: choice.enabled, whatsapp_phone: choice.whatsappPhone, telegram_chat_id: choice.telegramChatId,
    min_severity: toLevel[choice.minSeverity],
  }, options))
}

/** Sends one message per configured channel, so a wrong number shows up now rather than during an alarm. */
export async function sendNotificationTest(options: ServiceOptions = {}): Promise<NotificationTestResult[]> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') {
    await waitForMock(options)
    return []
  }
  const parsed = parseNotificationTest(await postJson<unknown>('/api/notifications/test', undefined, options))
  return parsed.results.map(result => ({ channel: result.channel as NotificationChannel, sent: result.status === 'sent', detail: result.detail }))
}
