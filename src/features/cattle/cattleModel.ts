import type { Camera, FarmEvent, FrameDetections } from '../../types/domain'
import { eventCatalog } from '../../lib/eventCatalog'

export interface CameraHerdRow {
  camera: Camera
  /** Null when the camera has no picture to analyze. */
  visible: number | null
  outside: number | null
  capturedAt: Date | null
}

/** Cattle visible per camera. Each camera covers only part of the farm, so rows are not a farm total. */
export function herdByCamera(cameras: readonly Camera[], frames: Readonly<Record<string, FrameDetections | null>>, hasPicture: (cameraId: string) => boolean): CameraHerdRow[] {
  return cameras.map(camera => {
    const frame = frames[camera.id]
    if (!frame || !hasPicture(camera.id)) return { camera, visible: null, outside: null, capturedAt: null }
    const cattle = frame.detections.filter(detection => detection.label === 'cow')
    return {
      camera,
      visible: cattle.length,
      outside: cattle.filter(detection => detection.insideSafeZone === false).length,
      capturedAt: frame.capturedAt,
    }
  })
}

export function visibleTotals(rows: readonly CameraHerdRow[]): { visible: number; outside: number; analyzed: number } {
  const analyzed = rows.filter(row => row.visible !== null)
  return {
    visible: analyzed.reduce((sum, row) => sum + (row.visible ?? 0), 0),
    outside: analyzed.reduce((sum, row) => sum + (row.outside ?? 0), 0),
    analyzed: analyzed.length,
  }
}

export function cattleEvents(events: readonly FarmEvent[]): FarmEvent[] {
  return events.filter(event => eventCatalog[event.kind].category === 'cattle')
}
