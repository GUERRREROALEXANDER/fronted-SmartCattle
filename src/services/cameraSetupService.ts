import { aiServiceUrl } from '../api/config'
import { getJson, requestJson } from '../api/httpClient'
import type { ServiceOptions } from './options'

// Talks to the AI service (live.py) on the farm PC, not to the backend: it is the program that opens the
// camera and runs YOLO. Requests carry no session token; that service has no accounts.

export type FoundCameraKind = 'rtsp' | 'ip-webcam' | 'droidcam'
export interface FoundCamera { host: string; ports: number[]; kinds: FoundCameraKind[] }
export interface CameraScan { network: string | null; cameras: FoundCamera[] }

/** An IP camera by address and credentials, or anything else by URL / phone-app address / webcam index. */
export type CameraSource =
  | { kind: 'ip'; host: string; username: string; password: string; port?: number }
  | { kind: 'url'; url: string }

const isKind = (value: unknown): value is FoundCameraKind => value === 'rtsp' || value === 'ip-webcam' || value === 'droidcam'

export function parseCameraScan(body: unknown): CameraScan {
  if (!body || typeof body !== 'object') throw new Error('Respuesta de escaneo no válida')
  const { network, cameras } = body as { network?: unknown; cameras?: unknown }
  const list = Array.isArray(cameras) ? cameras : []
  return {
    network: typeof network === 'string' ? network : null,
    cameras: list.flatMap(item => {
      if (!item || typeof item !== 'object' || typeof item.host !== 'string') return []
      const ports = Array.isArray(item.ports) ? item.ports.filter((port: unknown): port is number => typeof port === 'number') : []
      const kinds = Array.isArray(item.kinds) ? item.kinds.filter(isKind) : []
      return [{ host: item.host, ports, kinds }]
    }),
  }
}

/** Looks for cameras on the PC's local network (GET /cameras/scan). Takes a few seconds. */
export async function scanCameras(baseUrl = aiServiceUrl, options: ServiceOptions = {}): Promise<CameraScan> {
  return parseCameraScan(await getJson<unknown>('/cameras/scan', { ...options, baseUrl, token: null, timeoutMs: 60_000 }))
}

/** Points the AI service at a camera (POST /camera). It answers at once and reconnects in the background. */
export async function connectCamera(baseUrl: string, source: CameraSource, options: ServiceOptions = {}): Promise<void> {
  const body = source.kind === 'url'
    ? { url: source.url.trim() }
    // Only what the person typed: with just the IP, the AI service uses the credentials saved on its PC.
    : {
      host: source.host.trim(),
      ...(source.username.trim() ? { username: source.username.trim() } : {}),
      ...(source.password ? { password: source.password } : {}),
      ...(source.port ? { port: source.port } : {}),
    }
  await requestJson<unknown>('/camera', { ...options, baseUrl, method: 'POST', body, token: null, timeoutMs: 10_000 })
}

export interface CameraServiceState { cameraId: string; status: string; error: string | null }

/** What one AI service is doing right now (GET /status): which camera, and whether it is online. */
export async function getCameraServiceState(baseUrl: string, options: ServiceOptions = {}): Promise<CameraServiceState> {
  const body = await getJson<{ camera_id?: unknown; status?: unknown; error?: unknown }>('/status', { ...options, baseUrl, token: null, timeoutMs: 6000 })
  return {
    cameraId: typeof body.camera_id === 'string' ? body.camera_id : '',
    status: typeof body.status === 'string' ? body.status : 'unknown',
    error: typeof body.error === 'string' ? body.error : null,
  }
}

/** Polls GET /status until the camera is online or failed, or the time runs out; returns the last state seen. */
export async function waitForCamera(baseUrl: string, timeoutMs = 25_000, pollMs = 1500, options: ServiceOptions = {}): Promise<CameraServiceState> {
  const deadline = Date.now() + timeoutMs
  let state = await getCameraServiceState(baseUrl, options)
  while (state.status !== 'online' && state.status !== 'error' && Date.now() < deadline) {
    await new Promise(resolve => setTimeout(resolve, pollMs))
    state = await getCameraServiceState(baseUrl, options)
  }
  return state
}
