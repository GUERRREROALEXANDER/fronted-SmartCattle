import { authHeaders } from '../api/session'
import { safeStorage } from '../lib/safeStorage'

// A phone as a camera with nothing to install: its browser sends pictures to the AI service, so it needs no address,
// no password and no shared network with whoever is watching.

/** Saved as the camera's source, in place of an address. */
export const DEVICE_SOURCE = 'browser'
export const isDeviceCamera = (source: string) => source === DEVICE_SOURCE

/**
 * An address that only exists inside one network, which nothing on the internet can open. Webcam numbers are the same:
 * they belong to the PC running the service.
 */
export function onlyInsideItsNetwork(address: string): boolean {
  const text = address.trim()
  if (/^\d+$/.test(text)) return true
  const host = /^(?:[a-z]+:\/\/)?(?:[^/@]*@)?([^/:?]+)/i.exec(text)?.[1]?.toLowerCase() ?? ''
  return host === 'localhost' || host.endsWith('.local') || /^(10\.|127\.|192\.168\.|169\.254\.|172\.(1[6-9]|2\d|3[01])\.)/.test(host)
}

// Any camera whose picture can be seen on a computer, whatever its brand: the window showing it is what gets sent.
// The backend only knows "browser", so which of the two it is stays on the computer that set it up.

const screenKey = (cameraId: string) => `smartcattle.cameraScreen.${cameraId}`

export const canShareScreen = () => typeof navigator !== 'undefined' && typeof navigator.mediaDevices?.getDisplayMedia === 'function'
export const rememberScreenCamera = (cameraId: string) => safeStorage.setJson(screenKey(cameraId), true)
export const isScreenCamera = (cameraId: string) => safeStorage.getJson<boolean>(screenKey(cameraId)) === true

/** Why the window could not be shared; empty when the person just closed the dialog, which needs no telling. */
export function screenShareProblem(error: unknown): string {
  const name = error instanceof Error ? error.name : ''
  if (name === 'NotAllowedError' || name === 'AbortError') return ''
  if (name === 'TypeError' || name === 'NotSupportedError') return 'Este navegador no deja compartir una ventana. Abre esta página en Chrome o Edge, en un computador.'
  return 'No se pudo compartir esa ventana. Vuelve a intentarlo y elige otra.'
}

/** Enough for the model and light enough for mobile data. */
export const DEVICE_FRAME_WIDTH = 960
export const DEVICE_FRAME_QUALITY = 0.7
export const DEVICE_FRAME_MS = 400

/** The picture's size once it fits the width that is sent. A smaller camera is left as it is. */
export function frameSize(width: number, height: number, maxWidth = DEVICE_FRAME_WIDTH): { width: number; height: number } {
  const scale = Math.min(1, maxWidth / width)
  return { width: Math.round(width * scale), height: Math.round(height * scale) }
}

/** Sends one picture and returns the service's answer. Fails only when it could not be reached at all. */
export async function sendCameraFrame(baseUrl: string, cameraId: string, picture: Blob, signal?: AbortSignal): Promise<number> {
  const response = await fetch(`${baseUrl}/cameras/${encodeURIComponent(cameraId)}/frame`, {
    method: 'POST', body: picture, signal, headers: { 'Content-Type': 'image/jpeg', ...authHeaders() },
  })
  return response.status
}

/** Why this browser could not open its camera, in the words of the person holding the phone. */
export function deviceCameraProblem(error: unknown): string {
  const name = error instanceof Error ? error.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'El navegador no tiene permiso para usar la cámara. Permítelo en el candado junto a la dirección de la página y vuelve a intentarlo.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') return 'Este dispositivo no tiene una cámara disponible.'
  if (name === 'NotReadableError' || name === 'AbortError') return 'Otra aplicación está usando la cámara. Ciérrala y vuelve a intentarlo.'
  if (name === 'TypeError') return 'Este navegador no deja usar la cámara aquí. Abre la página con su dirección https:// en Chrome o Safari.'
  return 'No se pudo abrir la cámara de este dispositivo.'
}
