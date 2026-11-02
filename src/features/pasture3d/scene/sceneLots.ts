import type { FarmPlan, PlanPoint } from '../../../services/farmLayout'
import { planToWorld, type WorldPoint } from '../simulation/geometry'

/** A lot in world metres, the shape the terrain, grass and fences are built from. */
export interface SceneLot {
  id: string
  name: string
  boundary: readonly WorldPoint[]
}

/** Plan units (800 x 520) to world metres, centred on the farm. */
export function planPointToWorld(plan: Pick<FarmPlan, 'width' | 'height'>, point: PlanPoint): WorldPoint {
  return planToWorld(point, plan.width, plan.height)
}

export function sceneLots(plan: FarmPlan): SceneLot[] {
  return plan.lots.map(lot => ({ id: lot.id, name: lot.name, boundary: lot.boundary.map(point => planPointToWorld(plan, point)) }))
}

export function sceneTrack(plan: FarmPlan): WorldPoint[] {
  return plan.track.map(point => planPointToWorld(plan, point))
}
