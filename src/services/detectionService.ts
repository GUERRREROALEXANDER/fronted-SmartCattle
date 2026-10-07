import { dataMode } from '../api/config'
import { buildMockFrameDetections } from '../mocks/mockData'
import type { FrameDetections, Sourced } from '../types/domain'
import { resolveSource } from './dataSource'
import { getLiveStatus } from './liveService'
import { toFrameDetections } from './mappers'
import { resolveMockOnly, type ServiceOptions } from './options'

/** Latest detections: demo boxes in mock mode, otherwise the local AI service's last frame. */
export async function getFrameDetections(cameraId: string, options: ServiceOptions = {}): Promise<Sourced<FrameDetections | null>> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') return resolveMockOnly(options, now => buildMockFrameDetections(cameraId, now))
  const live = await getLiveStatus(options)
  return { data: live && live.camera_id === cameraId ? toFrameDetections(live) : null, source }
}
