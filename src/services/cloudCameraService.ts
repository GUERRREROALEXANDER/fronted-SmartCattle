import { dataMode } from '../api/config'
import { getJson, postJson } from '../api/httpClient'
import { ApiError } from '../api/errors'
import type { Sourced } from '../types/domain'
import type { ServiceOptions } from './options'

// Cameras watched from anywhere. An Imou camera opens through Imou's cloud by its serial number, so the AI service
// in the cloud reaches it wherever it is. A LAN address (192.168.x.x) only exists inside the farm's Wi-Fi: the
// backend never tries it and recommends the account's Imou cameras instead, keeping the typed address to show it.

export interface CameraSuggestion { serial: string; name: string; model: string | null; online: boolean; cameraId: string | null }
export interface CameraSuggestions { available: boolean; items: CameraSuggestion[] }
export type ConnectOutcome = 'connected' | 'choose' | 'unreachable'
export interface ConnectedCamera { id: string; name: string; address: string | null; status: 'online' | 'offline' | 'error'; cloud: boolean }
export interface ConnectResult {
  outcome: ConnectOutcome
  camera: ConnectedCamera | null
  suggestions: CameraSuggestion[]
  recommended: string | null
}

const text = (value: unknown): string | null => typeof value === 'string' && value.trim() ? value : null

function toSuggestion(value: unknown): CameraSuggestion | null {
  const item = value as Record<string, unknown> | null
  const serial = text(item?.serial)
  if (!item || !serial) return null
  return { serial, name: text(item.name) ?? `Imou ${serial}`, model: text(item.model), online: item.online === true, cameraId: text(item.camera_id) }
}

const suggestionsOf = (value: unknown) =>
  (Array.isArray(value) ? value : []).map(toSuggestion).filter((item): item is CameraSuggestion => item !== null)

function toCamera(value: unknown): ConnectedCamera | null {
  const item = value as Record<string, unknown> | null
  const id = text(item?.id)
  if (!item || !id) return null
  const status = item.status === 'online' || item.status === 'error' ? item.status : 'offline'
  return { id, name: text(item.name) ?? id, address: text(item.address), status, cloud: item.cloud === true }
}

/** The Imou cameras the system recommends: those of SmartCattle's Imou account, connected or not. None in demo mode. */
export async function listCameraSuggestions(options: ServiceOptions = {}): Promise<Sourced<CameraSuggestions>> {
  if ((options.mode ?? dataMode) === 'mock') return { source: 'mock', data: { available: false, items: [] } }
  const body = await getJson<Record<string, unknown>>('/api/cameras/suggestions', options)
  return { source: 'api', data: { available: body?.available === true, items: suggestionsOf(body?.items) } }
}

/** The account's cameras that open through the cloud, with the address their owner typed. */
export async function listCloudCameras(options: ServiceOptions = {}): Promise<Sourced<ConnectedCamera[]>> {
  if ((options.mode ?? dataMode) === 'mock') return { source: 'mock', data: [] }
  const body = await getJson<Record<string, unknown>>('/api/cameras/saved', options)
  const items = (Array.isArray(body?.items) ? body.items : []).map(toCamera)
    .filter((item): item is ConnectedCamera => item !== null && item.cloud)
  return { source: 'api', data: items }
}

/** Connects from an address or a serial number, or from a recommended camera (its serial plus the typed address). */
export async function connectCamera(input: { address?: string; serial?: string }, options: ServiceOptions = {}): Promise<ConnectResult> {
  const sent = Object.fromEntries(Object.entries(input).map(([key, value]) => [key, value?.trim()]).filter(([, value]) => value))
  const body = await postJson<Record<string, unknown>>('/api/cameras/connect', sent, options)
  const outcome: ConnectOutcome = body?.outcome === 'connected' || body?.outcome === 'choose' ? body.outcome : 'unreachable'
  return { outcome, camera: toCamera(body?.camera), suggestions: suggestionsOf(body?.suggestions), recommended: text(body?.recommended) }
}

/** Whether the person typed an address that only exists inside a home or farm network. */
export function isLanAddress(address: string): boolean {
  const host = address.trim().replace(/^[a-z]+:\/\//i, '').split(/[/:]/)[0]
  const parts = host.split('.').map(Number)
  if (parts.length === 4 && parts.every(part => Number.isInteger(part) && part >= 0 && part <= 255)) {
    const [a, b] = parts
    return a === 10 || a === 127 || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168) || (a === 169 && b === 254)
  }
  return !host.includes('.') || /\.(local|lan|home)$/i.test(host)
}

/** What went wrong, in the words the Cameras page shows. */
export function connectProblem(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === 'network' || error.kind === 'timeout') return 'No hay conexión con el servidor. Revisa el internet e inténtalo otra vez.'
    if (error.status === 401) return 'Tu sesión terminó. Vuelve a iniciar sesión.'
    if (error.status === 403) return 'Solo el dueño de la cuenta puede conectar cámaras.'
    if (error.status === 404) return 'Esa cámara no está en la cuenta Imou de SmartCattle. Revisa el número de serie.'
    if (error.status === 409) return error.detail?.includes('another account')
      ? 'Esa cámara ya está conectada en otra cuenta.' : 'Ya tienes una cámara con ese nombre o llegaste al límite de cámaras.'
    if (error.status === 422) return 'Escribe solo la dirección IP (por ejemplo 192.168.1.50), sin usuario ni contraseña.'
    if (error.status === 502) return 'La nube de Imou no respondió. Inténtalo en un momento.'
    if (error.status === 503) return 'El servidor todavía no tiene configurada la cuenta Imou.'
  }
  return 'No se pudo conectar la cámara. Inténtalo otra vez.'
}
