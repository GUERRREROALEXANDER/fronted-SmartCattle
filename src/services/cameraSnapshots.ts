import type { FrameDetections, Sourced, StreamSource } from '../types/domain'
import { getCameraStream } from './cameraService'
import { getFrameDetections } from './detectionService'

export interface CameraSnapshot { stream: StreamSource | null; frame: FrameDetections | null }

/** True when the browser can show a picture for this stream (not only a connected camera). */
export const hasPicture = (stream: StreamSource | null | undefined): boolean =>
  stream?.kind === 'image' || stream?.kind === 'mjpeg'

/** Stream source and latest detections for every camera, loaded together. */
export async function loadCameraSnapshots(ids: readonly string[], signal: AbortSignal): Promise<Sourced<Record<string, CameraSnapshot>>> {
  const results = await Promise.all(ids.map(async id => {
    const [stream, frame] = await Promise.all([getCameraStream(id, { signal }), getFrameDetections(id, { signal })])
    return { id, stream, frame }
  }))
  return {
    data: Object.fromEntries(results.map(({ id, stream, frame }) => [id, { stream: stream.data, frame: frame.data }])),
    source: results[0]?.stream.source ?? 'unavailable',
  }
}
