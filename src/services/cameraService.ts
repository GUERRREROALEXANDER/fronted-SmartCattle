import { dataMode } from '../api/config'
import { getJson } from '../api/httpClient'
import { parseCamerasResponse } from '../api/validate'
import { mockCameras, mockSafeZones } from '../mocks/mockData'
import { demoFeedCameraId, demoFeedSource } from '../mocks/mockCameraFeed'
import type { Camera, SafeZone, Sourced, StreamSource } from '../types/domain'
import { resolveSource } from './dataSource'
import { getLiveStatus, liveVideoUrl } from './liveService'
import { toCamera } from './mappers'
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

export function listSafeZones(cameraId: string, options: ServiceOptions = {}): Promise<Sourced<SafeZone[] | null>> {
  return resolveMockOnly(options, () => mockSafeZones.filter(zone => zone.cameraId === cameraId).map(zone => ({ ...zone, bounds: [...zone.bounds] })))
}

/**
 * Where the camera picture comes from. Outside mock mode the local AI service streams its camera
 * as MJPEG with boxes and safe zone already drawn in.
 */
export async function getCameraStream(cameraId: string, options: ServiceOptions = {}): Promise<Sourced<StreamSource | null>> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') return resolveMockOnly(options, (): StreamSource => cameraId === demoFeedCameraId ? demoFeedSource : { kind: 'none' })
  const live = await getLiveStatus(options)
  if (!live || live.camera_id !== cameraId || !live.width || !live.height) return { data: { kind: 'none' }, source }
  return { data: { kind: 'mjpeg', url: liveVideoUrl(options), width: live.width, height: live.height, annotated: true }, source }
}
