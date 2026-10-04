import { mockCameras, mockSafeZones } from '../mocks/mockData'
import { demoFeedCameraId, demoFeedSource } from '../mocks/mockCameraFeed'
import type { Camera, SafeZone, Sourced, StreamSource } from '../types/domain'
import { resolveMockOnly, type ServiceOptions } from './options'

export function listCameras(options: ServiceOptions = {}): Promise<Sourced<Camera[] | null>> {
  return resolveMockOnly(options, now => mockCameras.map(camera => ({ ...camera, lastSeenAt: new Date(now) })))
}

export function listSafeZones(cameraId: string, options: ServiceOptions = {}): Promise<Sourced<SafeZone[] | null>> {
  return resolveMockOnly(options, () => mockSafeZones.filter(zone => zone.cameraId === cameraId).map(zone => ({ ...zone, bounds: [...zone.bounds] })))
}

/** Where the camera picture comes from. No backend or AI service streams video yet. */
export function getCameraStream(cameraId: string, options: ServiceOptions = {}): Promise<Sourced<StreamSource | null>> {
  return resolveMockOnly(options, (): StreamSource => cameraId === demoFeedCameraId ? demoFeedSource : { kind: 'none' })
}
