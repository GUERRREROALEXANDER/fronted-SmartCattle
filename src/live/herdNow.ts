import type { FrameDetections, Posture } from '../types/domain'
import { entityKind, unitHash } from './herdTracker'

export interface HerdAnimal {
  id: string
  posture: Posture | null
  /** 0..1 along the strip; stable for the same animal so it does not jump between frames. */
  place: number
  outside: boolean
}

export interface PostureCounts { walking: number; standing: number; lying: number; unknown: number; total: number }

/** The cattle every camera sees in its latest frame, as the AI reports them. People and other objects are not cattle. */
export function herdNow(frames: Readonly<Record<string, FrameDetections>>): HerdAnimal[] {
  return Object.values(frames).flatMap(frame => frame.detections
    .filter(detection => entityKind(detection.label) === 'cow')
    .map((detection, index) => {
      const id = `${frame.cameraId}#${detection.trackId ?? index}`
      return { id, posture: detection.posture ?? null, place: unitHash(id, 7), outside: detection.insideSafeZone === false }
    }))
}

export function countPostures(animals: readonly Pick<HerdAnimal, 'posture'>[]): PostureCounts {
  const counts: PostureCounts = { walking: 0, standing: 0, lying: 0, unknown: 0, total: animals.length }
  for (const { posture } of animals) counts[posture ?? 'unknown']++
  return counts
}
