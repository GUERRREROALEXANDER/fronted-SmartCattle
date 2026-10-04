import { mockCameras, mockSafeZones } from '../mocks/mockData'
import type { Camera, SafeZone, Sourced } from '../types/domain'
import { resolveMockOnly, type ServiceOptions } from './options'

export function listCameras(options: ServiceOptions = {}): Promise<Sourced<Camera[] | null>> {
  return resolveMockOnly(options, now => mockCameras.map(camera => ({ ...camera, lastSeenAt: new Date(now) })))
}

export function listSafeZones(cameraId: string, options: ServiceOptions = {}): Promise<Sourced<SafeZone[] | null>> {
  return resolveMockOnly(options, () => mockSafeZones.filter(zone => zone.cameraId === cameraId).map(zone => ({ ...zone, bounds: [...zone.bounds] })))
}
