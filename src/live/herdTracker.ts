import type { FarmPlan, PlanLot, PlanPoint } from '../services/farmLayout'
import type { FrameDetections, NormalizedBounds, Occupancy, SafeZone } from '../types/domain'

// Turns what each camera sees into positions on the farm plan. A camera watches one lot; the safe zone
// drawn on its picture is mapped onto that lot's lindero, so a box the AI marks outside the zone lands
// outside the fence, and a box inside lands inside. Plan coordinates (800 x 520), no rendering here.

export type EntityKind = 'cow' | 'person' | 'other'

export interface TrackedEntity {
  /** Stable while the AI keeps tracking the same object (camera id + track id). */
  id: string
  kind: EntityKind
  /** Detector label as sent by the AI ("cow", "person", "dog"...). */
  label: string
  cameraId: string
  lotId: string
  target: PlanPoint
  /** Outside its lot's safe zone, by the AI's verdict. */
  outside: boolean
  confidence: number | null
  /** 'box': placed from a real bounding box. 'count': the camera only reported how many. */
  source: 'box' | 'count'
  trackId: number | null
}

/** Picture area treated as the lot when the camera has no safe zone drawn yet. */
const DEFAULT_BOUNDS: NormalizedBounds = [0.04, 0.12, 0.96, 0.98]
/** How far past the lindero (in lot units) an outside animal can be drawn, so it stays on the farm. */
const MAX_OVERSHOOT = 0.32
const OUTSIDE_MARGIN = 0.07
const INSIDE_MARGIN = 0.04

const COW_LABELS = new Set(['cow', 'cattle', 'bull', 'calf', 'vaca'])

export function entityKind(label: string): EntityKind {
  const value = label.toLowerCase()
  if (COW_LABELS.has(value)) return 'cow'
  if (value === 'person' || value === 'persona') return 'person'
  return 'other'
}

/** Deterministic 0..1 from a string, so count-only animals keep their spot between renders. */
export function unitHash(text: string, salt = 0): number {
  let hash = 2166136261 ^ salt
  for (let index = 0; index < text.length; index++) hash = Math.imul(hash ^ text.charCodeAt(index), 16777619)
  return ((hash >>> 0) % 10_000) / 10_000
}

/** Point of a quadrilateral lot for (s, t) in [0, 1]²: s runs along the first edge, t towards the far one. */
export function lotPoint(lot: Pick<PlanLot, 'boundary'>, s: number, t: number): PlanPoint {
  const [a, b, c, d] = lot.boundary.length >= 4 ? lot.boundary : [...lot.boundary, ...lot.boundary].slice(0, 4)
  const top = { x: a.x + (b.x - a.x) * s, y: a.y + (b.y - a.y) * s }
  const bottom = { x: d.x + (c.x - d.x) * s, y: d.y + (c.y - d.y) * s }
  return { x: top.x + (bottom.x - top.x) * t, y: top.y + (bottom.y - top.y) * t }
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))

/**
 * Lot coordinates of a picture point. The AI's inside/outside verdict wins over the geometry: a point
 * it calls outside is pushed just past the nearest edge, one it calls inside is kept off the fence.
 */
export function pictureToLot(u: number, v: number, bounds: NormalizedBounds, inside: boolean | null): { s: number; t: number } {
  const [x0, y0, x1, y1] = bounds
  let s = (u - x0) / Math.max(1e-6, x1 - x0)
  let t = (v - y0) / Math.max(1e-6, y1 - y0)
  s = clamp(s, -MAX_OVERSHOOT, 1 + MAX_OVERSHOOT)
  t = clamp(t, -MAX_OVERSHOOT, 1 + MAX_OVERSHOOT)
  const within = s >= 0 && s <= 1 && t >= 0 && t <= 1
  if (inside === true && !within) return { s: clamp(s, INSIDE_MARGIN, 1 - INSIDE_MARGIN), t: clamp(t, INSIDE_MARGIN, 1 - INSIDE_MARGIN) }
  if (inside === false && within) {
    // Nearest edge, then just across it.
    const gaps = [s, 1 - s, t, 1 - t]
    const nearest = gaps.indexOf(Math.min(...gaps))
    if (nearest === 0) s = -OUTSIDE_MARGIN
    else if (nearest === 1) s = 1 + OUTSIDE_MARGIN
    else if (nearest === 2) t = -OUTSIDE_MARGIN
    else t = 1 + OUTSIDE_MARGIN
  }
  return { s, t }
}

export interface TrackerInput {
  plan: FarmPlan
  frames: Readonly<Record<string, FrameDetections>>
  occupancy: Readonly<Record<string, Occupancy>>
  zones?: Readonly<Record<string, readonly SafeZone[]>>
}

/** Everything the cameras report right now, placed on the plan. */
export function trackEntities({ plan, frames, occupancy, zones = {} }: TrackerInput): TrackedEntity[] {
  const lots = new Map(plan.lots.map(lot => [lot.id, lot]))
  const entities: TrackedEntity[] = []

  for (const camera of plan.cameras) {
    const lot = lots.get(camera.lotId)
    if (!lot) continue
    const bounds = zones[camera.cameraId]?.[0]?.bounds ?? DEFAULT_BOUNDS
    const frame = frames[camera.cameraId]

    if (frame) {
      frame.detections.forEach((detection, index) => {
        const u = detection.box.x + detection.box.width / 2
        const v = detection.box.y + detection.box.height
        const { s, t } = pictureToLot(u, v, bounds, detection.insideSafeZone)
        const trackId = detection.trackId ?? null
        entities.push({
          id: trackId === null ? `${camera.cameraId}:${detection.label}:${index}` : `${camera.cameraId}#${trackId}`,
          kind: entityKind(detection.label), label: detection.label, cameraId: camera.cameraId, lotId: lot.id,
          target: lotPoint(lot, s, t), outside: detection.insideSafeZone === false || !(s >= 0 && s <= 1 && t >= 0 && t <= 1),
          confidence: detection.confidence, source: 'box', trackId,
        })
      })
      continue
    }

    // No boxes, only a head count: draw that many animals, spread over the lot, the outside ones past the far fence.
    const count = occupancy[camera.cameraId]
    if (!count) continue
    for (let index = 0; index < count.inside + count.outside; index++) {
      const outside = index >= count.inside
      const id = `${camera.cameraId}:count:${outside ? 'out' : 'in'}:${outside ? index - count.inside : index}`
      const s = 0.1 + unitHash(id, 1) * 0.8
      const t = outside ? 1 + OUTSIDE_MARGIN + unitHash(id, 2) * 0.1 : 0.12 + unitHash(id, 2) * 0.76
      entities.push({
        id, kind: 'cow', label: 'cow', cameraId: camera.cameraId, lotId: lot.id, target: lotPoint(lot, s, t),
        outside, confidence: null, source: 'count', trackId: null,
      })
    }
  }
  return entities
}
