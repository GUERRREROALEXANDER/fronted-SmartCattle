import { useCallback, useEffect, useMemo, useState, useSyncExternalStore } from 'react'
import { useResource } from '../lib/useResource'
import { getFarmPlan, listSafeZones } from '../services'
import type { FarmPlan } from '../services/farmLayout'
import type { SafeZone } from '../types/domain'
import { trackEntities, type TrackedEntity } from './herdTracker'
import { createHerdMotion, stepHerd, syncHerd, type HerdAgent, type MotionConfig } from './herdMotion'
import { useLive } from './useLive'

const PLAN_REFRESH_MS = 60_000

/**
 * The farm plan plus what the cameras see on it right now. The plan is re-read when the set of cameras
 * changes, so a new camera or lot shows up without a reload.
 */
export function useFarmLive() {
  const live = useLive()
  const cameraKey = live.cameras.map(camera => camera.id).join(',')
  const plan = useResource(signal => getFarmPlan({ signal }), { key: cameraKey, refreshMs: PLAN_REFRESH_MS })
  const planCameraIds = (plan.data?.cameras ?? []).map(camera => camera.cameraId)
  const zones = useResource(async signal => {
    const results = await Promise.all(planCameraIds.map(id => listSafeZones(id, { signal }).catch(() => ({ data: null }))))
    const byCamera: Record<string, readonly SafeZone[]> = {}
    planCameraIds.forEach((id, index) => { byCamera[id] = results[index].data ?? [] })
    return { data: byCamera, source: 'api' as const }
  }, { key: planCameraIds.join(','), refreshMs: PLAN_REFRESH_MS })

  const entities = useMemo<TrackedEntity[]>(
    () => plan.data ? trackEntities({ plan: plan.data, frames: live.frames, occupancy: live.occupancy, zones: zones.data ?? {} }) : [],
    [plan.data, live.frames, live.occupancy, zones.data],
  )
  return { live, plan, entities }
}

/**
 * The animation state lives outside React (it changes every frame); React subscribes only to who is on
 * the farm and who is outside, so a walking herd costs no re-renders.
 */
function createHerdStore(config: MotionConfig) {
  const motion = createHerdMotion(config)
  const listeners = new Set<() => void>()
  let key = ''
  let agents: HerdAgent[] = []
  return {
    motion,
    subscribe(listener: () => void) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    getAgents: () => agents,
    publish() {
      const next = [...motion.agents.values()].map(agent => `${agent.id}:${agent.outside ? 1 : 0}:${agent.leaving ? 1 : 0}`).join('|')
      if (next === key) return
      key = next
      agents = [...motion.agents.values()]
      for (const listener of listeners) listener()
    },
  }
}

/** Animated agents for the given entities, in the space `config.toSpace` maps to. */
export function useHerdMotion(plan: FarmPlan | null, entities: readonly TrackedEntity[], config: MotionConfig, reduceMotion: boolean) {
  const [store] = useState(() => createHerdStore(config))

  useEffect(() => {
    if (!plan) return
    syncHerd(store.motion, entities, { instant: reduceMotion })
    store.publish()
  }, [entities, plan, reduceMotion, store])

  const step = useCallback((dt: number) => {
    if (stepHerd(store.motion, Math.min(dt, 0.1), { reduceMotion })) store.publish()
  }, [reduceMotion, store])

  const agents = useSyncExternalStore(store.subscribe, store.getAgents, store.getAgents)
  return { motion: store.motion, agents, step }
}
