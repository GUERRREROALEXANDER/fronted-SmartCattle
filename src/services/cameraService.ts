import { dataMode } from '../api/config'
import { getJson } from '../api/httpClient'
import { parseCamerasResponse } from '../api/validate'
import { parseZonesResponse } from '../api/parsers'
import { mockCameras, mockSafeZones } from '../mocks/mockData'
import { demoFeedCameraId, demoFeedSource } from '../mocks/mockCameraFeed'
import type { Camera, SafeZone, Sourced, StreamSource } from '../types/domain'
import { resolveSource } from './dataSource'
import { getLiveSource } from './liveService'
import { toCamera, toSafeZone } from './mappers'
import { resolveMockOnly, waitForMock, type ServiceOptions } from './options'

/**
 * Cameras connected right now: the backend keeps every camera it has ever seen, but only those the
 * AI service currently reports online are shown, so a disconnected camera disappears until it is back.
 * Demo cameras only in mock mode.
 */
export async function listCameras(options: ServiceOptions = {}): Promise<Sourced<Camera[] | null>> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') {
    await waitForMock(options)
    const now = options.now ?? new Date()
    return { data: mockCameras.map(camera => ({ ...camera, lastSeenAt: new Date(now) })), source }
  }
  const response = parseCamerasResponse(await getJson<unknown>('/api/cameras', options))
  return { data: response.items.filter(camera => camera.status === 'online').map(toCamera), source }
}

/**
 * Every camera the AI service has reported, with its effective status, so the farm view can show a
 * camera that dropped offline or failed instead of hiding it.
 */
export async function listAllCameras(options: ServiceOptions = {}): Promise<Sourced<Camera[]>> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') {
    await waitForMock(options)
    const now = options.now ?? new Date()
    return { data: mockCameras.map(camera => ({ ...camera, lastSeenAt: new Date(now) })), source }
  }
  return { data: parseCamerasResponse(await getJson<unknown>('/api/cameras', options)).items.map(toCamera), source }
}

/** Active safe zones drawn for one camera (GET /api/zones?camera_id=). */
export async function listSafeZones(cameraId: string, options: ServiceOptions = {}): Promise<Sourced<SafeZone[] | null>> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') {
    await waitForMock(options)
    return { data: mockSafeZones.filter(zone => zone.cameraId === cameraId).map(zone => ({ ...zone, bounds: [...zone.bounds] })), source }
  }
  const response = parseZonesResponse(await getJson<unknown>('/api/zones', { ...options, query: { camera_id: cameraId } }))
  return { data: response.items.filter(zone => zone.active).map(toSafeZone), source }
}

/**
 * Where the camera picture comes from. Outside mock mode the local AI service streams its camera
 * as MJPEG with boxes and safe zone already drawn in.
 */
export async function getCameraStream(cameraId: string, options: ServiceOptions = {}): Promise<Sourced<StreamSource | null>> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') return resolveMockOnly(options, (): StreamSource => cameraId === demoFeedCameraId ? demoFeedSource : { kind: 'none' })
  const live = await getLiveSource(cameraId, options)
  if (!live?.status.width || !live.status.height) return { data: { kind: 'none' }, source }
  return { data: { kind: 'mjpeg', url: `${live.baseUrl}/video.mjpg`, width: live.status.width, height: live.status.height, annotated: true }, source }
}
