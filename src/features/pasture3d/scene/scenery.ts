import type { FarmPlan } from '../../../mocks/mockFarmPlan'
import {
  closestPointOnPolygon,
  planToWorld,
  pointInPolygon,
  type WorldPoint,
} from '../simulation/geometry'
import type { SimulationLot } from '../simulation/herdSimulation'
import { mulberry32, randomRange } from '../simulation/rng'
import type { TreeTone, TreeVariant } from '../kit/nature/Tree'

export interface TreePlacement {
  position: [number, number, number]
  rotation: number
  scale: number
  variant: TreeVariant
  tone: TreeTone
}

export interface RockPlacement {
  position: [number, number, number]
  seed: number
  count: number
}

export interface CameraPolePlacement {
  id: string
  position: [number, number, number]
  heading: number
}

/** Barn sits west of the corral with its door facing the pens. */
export const BARN_POSITION: WorldPoint = { x: -31.5, z: -1.5 }
export const TROUGH_POSITION: WorldPoint = { x: -27.4, z: 5.2 }

const TONES: readonly TreeTone[] = ['dark', 'mid', 'mid', 'light']

function distanceToPolyline(point: WorldPoint, polyline: readonly WorldPoint[]) {
  let best = Number.POSITIVE_INFINITY
  for (let index = 0; index < polyline.length - 1; index += 1) {
    const segment = [polyline[index], polyline[index + 1]]
    const closest = closestPointOnPolygon(point, segment)
    best = Math.min(best, Math.hypot(point.x - closest.x, point.z - closest.z))
  }
  return best
}

function isClear(
  point: WorldPoint,
  lots: readonly SimulationLot[],
  track: readonly WorldPoint[],
  taken: readonly WorldPoint[],
  clearance: number,
) {
  for (const lot of lots) {
    if (pointInPolygon(point, lot.boundary)) return false
    const edge = closestPointOnPolygon(point, lot.boundary)
    if (Math.hypot(point.x - edge.x, point.z - edge.z) < clearance) return false
  }
  if (distanceToPolyline(point, track) < clearance) return false
  for (const structure of [BARN_POSITION, TROUGH_POSITION]) {
    if (Math.hypot(point.x - structure.x, point.z - structure.z) < 6) return false
  }
  return taken.every(other => Math.hypot(point.x - other.x, point.z - other.z) > clearance * 1.4)
}

export function buildScenery(
  lots: readonly SimulationLot[],
  track: readonly WorldPoint[],
  seed = 7,
) {
  const rng = mulberry32(seed)
  const taken: WorldPoint[] = []
  const trees: TreePlacement[] = []
  const rocks: RockPlacement[] = []

  for (let attempt = 0; attempt < 900 && trees.length < 46; attempt += 1) {
    // Bias toward a belt around the farm so the pasture itself stays readable.
    const angle = rng() * Math.PI * 2
    const radius = randomRange(rng, 0.55, 1.35)
    const point = { x: Math.cos(angle) * radius * 58, z: Math.sin(angle) * radius * 42 }
    if (!isClear(point, lots, track, taken, 3)) continue
    // Keep the south foreground open: the preset cameras look across it.
    if (point.z > 24 && Math.abs(point.x) < 36) continue
    taken.push(point)
    trees.push({
      position: [point.x, 0, point.z],
      rotation: rng() * Math.PI * 2,
      scale: randomRange(rng, 0.85, 1.35),
      variant: rng() < 0.3 ? 'pine' : 'broadleaf',
      tone: TONES[Math.floor(rng() * TONES.length)],
    })
  }

  for (let attempt = 0; attempt < 400 && rocks.length < 14; attempt += 1) {
    const point = { x: randomRange(rng, -48, 48), z: randomRange(rng, -34, 34) }
    if (!isClear(point, lots, track, taken, 1.6)) continue
    taken.push(point)
    rocks.push({ position: [point.x, 0, point.z], seed: Math.floor(rng() * 10_000), count: 1 + Math.floor(rng() * 4) })
  }

  return { trees, rocks }
}

export function buildCameraPoles(plan: FarmPlan): CameraPolePlacement[] {
  return plan.cameras.map(camera => {
    const point = planToWorld(camera.position, plan.width, plan.height)
    return { id: camera.cameraId, position: [point.x, 0, point.z], heading: camera.heading }
  })
}
