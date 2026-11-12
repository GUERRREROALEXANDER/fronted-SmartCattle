import { aiServiceUrl, dataMode } from '../api/config'
import { deleteJson, getJson, postJson } from '../api/httpClient'
import { mockCameras } from '../mocks/mockData'
import type { Sourced } from '../types/domain'
import type { CameraSource } from './cameraSetupService'
import type { ServiceOptions } from './options'

// The cameras of this account, kept by the backend. Saving one opens nothing: only connecting it starts the video and
// the AI, and that goes to the AI service on the PC at the farm.

export type SavedCameraStatus = 'online' | 'offline' | 'error'
export interface SavedCamera { id: string; name: string; source: string; status: SavedCameraStatus }
export interface CameraLogin { username: string; password: string }
export interface Pairing { code: string; expiresInSeconds: number }

function toSaved(value: unknown): SavedCamera {
  const item = value as Partial<SavedCamera> | null
  if (!item || typeof item.id !== 'string' || typeof item.name !== 'string' || typeof item.source !== 'string') {
    throw new Error('Respuesta de cámaras no válida')
  }
  const status = item.status === 'online' || item.status === 'error' ? item.status : 'offline'
  return { id: item.id, name: item.name, source: item.source, status }
}

export async function listSavedCameras(options: ServiceOptions = {}): Promise<Sourced<SavedCamera[]>> {
  if ((options.mode ?? dataMode) === 'mock') {
    return { source: 'mock', data: mockCameras.map(camera => ({ id: camera.id, name: camera.name, source: camera.id, status: 'online' })) }
  }
  const body = await getJson<{ items?: unknown }>('/api/cameras/saved', options)
  return { source: 'api', data: (Array.isArray(body.items) ? body.items : []).map(toSaved) }
}

export async function saveCamera(name: string, source: string, options: ServiceOptions = {}): Promise<SavedCamera> {
  return toSaved(await postJson<unknown>('/api/cameras/saved', { name: name.trim(), source: source.trim() }, options))
}

export async function deleteSavedCamera(id: string, options: ServiceOptions = {}): Promise<void> {
  await deleteJson<unknown>(`/api/cameras/saved/${encodeURIComponent(id)}`, options)
}

/** A code for the QR: it lets a phone save one camera in this account, once and for a few minutes. */
export async function startPairing(options: ServiceOptions = {}): Promise<Pairing> {
  const body = await postJson<{ code?: unknown; expires_in?: unknown }>('/api/cameras/pairing', undefined, options)
  if (typeof body.code !== 'string') throw new Error('Respuesta de vinculación no válida')
  return { code: body.code, expiresInSeconds: typeof body.expires_in === 'number' ? body.expires_in : 600 }
}

/** Sent from the phone, which has no session: the code says whose camera it is. */
export async function savePairedCamera(code: string, name: string, source: string, options: ServiceOptions = {}): Promise<SavedCamera> {
  return toSaved(await postJson<unknown>('/api/cameras/paired', { code, name: name.trim(), source: source.trim() }, { ...options, token: null }))
}

/** Where this account's PC at the farm is reached right now; null while it is off or not linked yet. */
export async function getFarmPc(options: ServiceOptions = {}): Promise<Sourced<string | null>> {
  if ((options.mode ?? dataMode) === 'mock') return { source: 'mock', data: null }
  const body = await getJson<{ url?: unknown }>('/api/farm-pc', options)
  return { source: 'api', data: typeof body.url === 'string' ? body.url : null }
}

/** A code short enough to type on the farm's PC, which links it to this account. */
export async function startFarmPcPairing(options: ServiceOptions = {}): Promise<Pairing> {
  const body = await postJson<{ code?: unknown; expires_in?: unknown }>('/api/farm-pc/pairing', undefined, options)
  if (typeof body.code !== 'string') throw new Error('Respuesta de vinculación no válida')
  return { code: body.code, expiresInSeconds: typeof body.expires_in === 'number' ? body.expires_in : 600 }
}

/** What the AI service needs to open a saved camera. The login is typed each time: it is never stored. */
export function connectionFor(source: string, login?: CameraLogin): CameraSource {
  if (!source.startsWith('rtsp://')) return { kind: 'url', url: source }
  const url = new URL(source.replace(/^rtsp:/, 'http:'))
  const route = url.pathname !== '/' || url.search
  // A full link can work as it is. A bare IP cannot: it needs a login, and the service adds the usual route.
  if (!login?.password && route) return { kind: 'url', url: source }
  return {
    kind: 'ip', host: url.hostname, username: login?.username ?? '', password: login?.password ?? '',
    ...(url.port ? { port: Number(url.port) } : {}),
    ...(route ? { path: `${url.pathname}${url.search}` } : {}),
  }
}

// The ports of SmartCattle itself, which people copy from the browser's address bar.
const OWN_PORTS = /:(5173|4173|8000|8090)(\/|$)/

/** What is wrong with an address before saving it, in the words of the person typing it; null if it may be a camera. */
export function addressProblem(source: string): string | null {
  return OWN_PORTS.test(source.trim())
    ? 'Esa es la dirección de este panel, no la de una cámara. Escribe la IP que muestra la app de la cámara o del celular.'
    : null
}

/** Browsers fill this field with the email of the app's own login; a camera's user is something like "admin". */
export function loginProblem(username: string): string | null {
  return username.includes('@')
    ? 'En «Usuario» va el usuario de la cámara, no tu correo. Casi siempre es admin: déjalo vacío o escríbelo.'
    : null
}

/** The address to save for an IP camera: its link, without the password. */
export function ipCameraSource(host: string, path = ''): string {
  const route = path.trim()
  return `rtsp://${host.trim()}${route ? (route.startsWith('/') ? route : `/${route}`) : ''}`
}

const localNames = new Set(['localhost', '127.0.0.1', '[::1]'])

/** This PC's address on the farm's wifi, as the AI service sees it; null if it does not know. */
export async function getServiceHost(baseUrl = aiServiceUrl, options: ServiceOptions = {}): Promise<string | null> {
  const body = await getJson<{ lan_host?: unknown }>('/status', { ...options, baseUrl, token: null, timeoutMs: 6000 })
  return typeof body.lan_host === 'string' && !localNames.has(body.lan_host) ? body.lan_host : null
}

/**
 * The link inside the QR. A phone cannot use "localhost", so a page opened that way needs this PC's address on the
 * network. Null when there is no address a phone could open.
 */
export function phoneLink(code: string, page: Pick<Location, 'protocol' | 'hostname' | 'port'>, serviceHost: string | null): string | null {
  const host = localNames.has(page.hostname) ? serviceHost : page.hostname
  if (!host) return null
  return `${page.protocol}//${host}${page.port ? `:${page.port}` : ''}/conectar-celular?code=${encodeURIComponent(code)}`
}
