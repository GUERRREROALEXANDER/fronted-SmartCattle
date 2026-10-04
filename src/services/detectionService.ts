import { buildMockFrameDetections } from '../mocks/mockData'
import type { FrameDetections, Sourced } from '../types/domain'
import { resolveMockOnly, type ServiceOptions } from './options'

export function getFrameDetections(cameraId: string, options: ServiceOptions = {}): Promise<Sourced<FrameDetections | null>> {
  return resolveMockOnly(options, now => buildMockFrameDetections(cameraId, now))
}
