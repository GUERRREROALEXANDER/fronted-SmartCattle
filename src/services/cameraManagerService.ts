import { ApiError } from '../api/errors'
import { deleteJson, getJson, postJson } from '../api/httpClient'
import type { Sourced } from '../types/domain'
import type { ServiceOptions } from './options'

// RTSP cameras, through the backend (/api/camera-streams). The backend holds the camera service's key and limits each
// account to its own cameras: the browser sends its session and nothing else.

export type ManagedCameraState = 'sin_configurar' | 'conectando' | 'transmitiendo' | 'reconectando' | 'detenido'

export interface ManagedCamera {
  id: string
  name: string
  state: ManagedCameraState
  /** Where the camera is, with nothing else of its URL. */
  address: string | null
  retries: number
  hlsUrl: string | null
}

const STATES: readonly string[] = ['sin_configurar', 'conectando', 'transmitiendo', 'reconectando', 'detenido']
const MAX_URL_LENGTH = 500

function toCamera(value: unknown): ManagedCamera {
  const item = value as Record<string, unknown> | null
  if (!item || typeof item.id !== 'string' || typeof item.name !== 'string') throw new ApiError('parse', 'Invalid camera')
  const hls = item.hls_url
  return {
    id: item.id,
    name: item.name,
    // A state this version does not know is not claimed to be working.
    state: typeof item.state === 'string' && STATES.includes(item.state) ? item.state as ManagedCameraState : 'detenido',
    address: typeof item.address === 'string' ? item.address : null,
    retries: typeof item.retries === 'number' ? item.retries : 0,
    hlsUrl: typeof hls === 'string' && /^https?:\/\//.test(hls) ? hls : null,
  }
}

export async function listManagedCameras(options: ServiceOptions = {}): Promise<Sourced<ManagedCamera[]>> {
  const body = await getJson<{ items?: unknown }>('/api/camera-streams', options)
  return { source: 'api', data: (Array.isArray(body.items) ? body.items : []).map(toCamera) }
}

/** Transmits the camera with this name, saving it first if the account has none. */
export async function configureManagedCamera(name: string, url: string, options: ServiceOptions = {}): Promise<ManagedCamera> {
  return toCamera(await postJson<unknown>('/api/camera-streams', { name: name.trim(), url: url.trim() }, options))
}

export async function removeManagedCamera(cameraId: string, options: ServiceOptions = {}): Promise<void> {
  await deleteJson<unknown>(`/api/camera-streams/${encodeURIComponent(cameraId)}`, options)
}

export function managedNameProblem(value: string): string | null {
  return value.trim() ? null : 'Escribe un nombre para esta cámara.'
}

export function rtspUrlProblem(value: string): string | null {
  const url = value.trim()
  if (!url) return 'Escribe la URL de la cámara.'
  if (!/^rtsps?:\/\//i.test(url)) return 'La URL debe empezar por rtsp://'
  if (url.length > MAX_URL_LENGTH || /\s/.test(url)) return 'Esa URL no es válida: revisa que no tenga espacios.'
  return /^rtsps?:\/\/[^/\s]+/i.test(url) ? null : 'Falta la IP de la cámara después de rtsp://'
}

export interface ManagedStateView { tone: 'safe' | 'info' | 'warning' | 'inactive'; label: string; text: string }

/** What each state means to whoever is looking at the camera. */
export function managedStateView(camera: Pick<ManagedCamera, 'state' | 'retries'>): ManagedStateView {
  switch (camera.state) {
    case 'transmitiendo': return { tone: 'safe', label: 'Transmitiendo', text: 'La cámara está enviando video.' }
    case 'conectando': return { tone: 'info', label: 'Conectando', text: 'Abriendo la cámara. Puede tardar unos segundos.' }
    case 'reconectando': return {
      tone: 'warning', label: 'Reconectando',
      text: camera.retries >= 3
        ? `La cámara no responde (${camera.retries} intentos). Revisa que esté encendida y que su URL y contraseña sean correctas.`
        : 'Se perdió la señal. Se está intentando de nuevo por sí solo.',
    }
    case 'sin_configurar': return { tone: 'inactive', label: 'Sin configurar', text: 'Esta cámara todavía no tiene una URL.' }
    case 'detenido': return { tone: 'inactive', label: 'Detenida', text: 'El servicio de cámaras no la está transmitiendo.' }
  }
}

/** What to do about a failure, in the person's words. The server's own text never reaches them. */
export function managerProblem(error: unknown): string {
  if (error instanceof ApiError) {
    if (error.kind === 'network' || error.kind === 'timeout') return 'No se pudo contactar el servidor. Revisa la conexión e inténtalo de nuevo.'
    if (error.status === 403) return 'Solo el dueño de la finca puede conectar o quitar cámaras.'
    if (error.status === 404) return 'Esa cámara ya no está en el servicio de cámaras.'
    if (error.status === 409) return 'Ya se alcanzó el máximo de cámaras. Quita una antes de agregar otra.'
    if (error.status === 422) return 'No se aceptó esa dirección. Revisa la URL; si la contraseña tiene símbolos como @ o /, codifícalos (@ es %40).'
    if (error.status === 429) return 'Demasiados intentos seguidos. Espera un momento.'
    if (error.status === 502) return 'El servidor no pudo identificarse ante el servicio de cámaras. Avísale a quien lo administra.'
    if (error.status === 503) return 'El servicio de cámaras no está disponible ahora. Comprueba que esté encendido.'
  }
  return 'No se pudo completar. Inténtalo de nuevo en unos segundos.'
}
