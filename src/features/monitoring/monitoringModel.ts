import type { Camera, Detection, FarmEvent, StreamSource } from '../../types/domain'

/** The requested camera if it exists, else the camera with the most recent alert, else the first one. */
export function pickCamera(cameras: readonly Camera[], requestedId: string | null, alerts: readonly FarmEvent[]): Camera | null {
  return cameras.find(camera => camera.id === requestedId)
    ?? cameras.find(camera => alerts.some(alert => alert.cameraId === camera.id))
    ?? cameras[0]
    ?? null
}

export interface DetectionSummary { cattle: number; people: number; other: number; outside: number }

export function summarizeDetections(detections: readonly Detection[]): DetectionSummary {
  const summary = { cattle: 0, people: 0, other: 0, outside: 0 }
  for (const detection of detections) {
    if (detection.label === 'cow') summary.cattle++
    else if (detection.label === 'person') summary.people++
    else summary.other++
    if (detection.insideSafeZone === false) summary.outside++
  }
  return summary
}

export type StageState = 'loading' | 'offline' | 'error' | 'connecting' | 'no-stream' | 'unsupported' | 'live'

/** What the camera stage can show, from the camera status and its stream source. */
export function stageState(camera: Camera | null, stream: StreamSource | null | undefined, streamLoading: boolean): StageState {
  if (!camera || streamLoading) return 'loading'
  if (camera.status === 'offline') return 'offline'
  if (camera.status === 'error') return 'error'
  if (camera.status === 'connecting') return 'connecting'
  if (!stream || stream.kind === 'none') return 'no-stream'
  if (stream.kind === 'hls') return 'unsupported'
  return 'live'
}

export type LabelPlacement = 'above' | 'below'

/**
 * Greedy label placement: labels sit above their box unless they would collide with a label
 * already placed above, in which case they move below the box. Widths are estimated as a share
 * of the frame width because labels have a fixed pixel size.
 */
export function placeLabels(detections: readonly Detection[], labelWidth = 0.12, labelHeight = 0.05): Map<string, LabelPlacement> {
  const placed: { x: number; y: number }[] = []
  const result = new Map<string, LabelPlacement>()
  for (const detection of [...detections].sort((a, b) => a.box.x - b.box.x)) {
    const { x, y } = detection.box
    const collides = placed.some(other => Math.abs(other.x - x) < labelWidth && Math.abs(other.y - y) < labelHeight)
    if (collides) result.set(detection.id, 'below')
    else {
      result.set(detection.id, 'above')
      placed.push({ x, y })
    }
  }
  return result
}

export function detectionSummaryText({ cattle, people, other }: DetectionSummary): string {
  const parts = [
    `${cattle} ${cattle === 1 ? 'bovino' : 'bovinos'}`,
    `${people} ${people === 1 ? 'persona' : 'personas'}`,
  ]
  if (other > 0) parts.push(`${other} ${other === 1 ? 'otro objeto' : 'otros objetos'}`)
  return parts.join(' · ')
}
