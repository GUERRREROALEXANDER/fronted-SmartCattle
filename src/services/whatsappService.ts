import { dataMode } from '../api/config'
import { ApiError } from '../api/errors'
import { deleteJson, getJson, patchJson, postJson } from '../api/httpClient'
import { safeStorage } from '../lib/safeStorage'
import type { Sourced } from '../types/domain'
import { resolveSource } from './dataSource'
import type { ServiceOptions } from './options'

// The number that receives alerts. The backend only sends to a number its owner proved they hold, so typing it is not
// enough: a code goes to it by WhatsApp, and writing that code back is what links it.

export interface WhatsappContact { phone: string; enabled: boolean }

export const WHATSAPP_PENDING_KEY = 'smartcattle.whatsapp.pending'

/** The number given when signing up, until it is verified or the person says not now. */
export const pendingWhatsapp = () => safeStorage.getJson<string>(WHATSAPP_PENDING_KEY)
export const rememberPendingWhatsapp = (phone: string) => safeStorage.setJson(WHATSAPP_PENDING_KEY, phone)
export const forgetPendingWhatsapp = () => safeStorage.remove(WHATSAPP_PENDING_KEY)

// The demo has no server and sends nothing: it only remembers what was typed.
let mockContact: WhatsappContact | null = null
let mockPhone: string | null = null

const isMock = (options: ServiceOptions) => resolveSource('backend', options.mode ?? dataMode) === 'mock'

function toContact(value: unknown): WhatsappContact {
  const item = value as { phone?: unknown; enabled?: unknown } | null
  if (!item || typeof item.phone !== 'string' || typeof item.enabled !== 'boolean') throw new Error('Respuesta de WhatsApp no válida')
  return { phone: item.phone, enabled: item.enabled }
}

/** The account's linked number; null when it has none. */
export async function getWhatsappContact(options: ServiceOptions = {}): Promise<Sourced<WhatsappContact | null>> {
  if (isMock(options)) return { source: 'mock', data: mockContact }
  try {
    return { source: 'api', data: toContact(await getJson<unknown>('/api/auth/me/whatsapp', options)) }
  } catch (error) {
    if (error instanceof ApiError && error.status === 404) return { source: 'api', data: null }
    throw error
  }
}

/** Queues the code. It only arrives while the WhatsApp service is running. */
export async function startWhatsappVerification(phone: string, options: ServiceOptions = {}): Promise<void> {
  if (isMock(options)) {
    mockPhone = phone
    return
  }
  await postJson<unknown>('/api/auth/me/whatsapp/verification', { phone }, options)
}

export async function confirmWhatsappCode(code: string, options: ServiceOptions = {}): Promise<WhatsappContact> {
  if (isMock(options)) {
    if (!mockPhone) throw new ApiError('http', 'No code requested', { status: 400 })
    mockContact = { phone: mockPhone, enabled: true }
    return mockContact
  }
  return toContact(await postJson<unknown>('/api/auth/me/whatsapp/verify', { code }, options))
}

export async function setWhatsappEnabled(enabled: boolean, options: ServiceOptions = {}): Promise<WhatsappContact> {
  if (isMock(options)) {
    if (!mockContact) throw new ApiError('http', 'No number', { status: 404 })
    mockContact = { ...mockContact, enabled }
    return mockContact
  }
  return toContact(await patchJson<unknown>('/api/auth/me/whatsapp', { enabled }, options))
}

export async function removeWhatsappNumber(options: ServiceOptions = {}): Promise<void> {
  if (isMock(options)) {
    mockContact = null
    mockPhone = null
    return
  }
  await deleteJson<unknown>('/api/auth/me/whatsapp', options)
}

/** What went wrong, in the person's words. The server's own text never reaches them. */
export function whatsappProblem(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === 'network' || error.kind === 'timeout') return 'No se pudo contactar el servidor. Revisa la conexión e inténtalo de nuevo.'
    if (error.status === 400) return 'Ese código está mal o ya venció. Pide uno nuevo.'
    if (error.status === 404) return 'Este servidor todavía no ofrece avisos por WhatsApp.'
    if (error.status === 422) return 'Revisa el dato: el número va con +57 y el código tiene 6 dígitos.'
    if (error.status === 429) return 'Pediste muchos códigos seguidos. Espera un rato y vuelve a intentarlo.'
    if (error.status === 401) return 'Tu sesión venció. Vuelve a entrar.'
  }
  return 'No se pudo completar. Inténtalo de nuevo en unos segundos.'
}
