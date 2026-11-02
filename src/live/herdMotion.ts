import type { TrackedEntity } from './herdTracker'
import { unitHash } from './herdTracker'

// Smooth motion between AI updates. Detections arrive a few times per second and jump; agents walk to
// each new target at an animal's pace instead of teleporting, turn gradually, and appear or leave with
// a short scale transition. Pure and frame-driven: the 3D scene and the 2D plan each run one instance.

export type CowCoat = 'holstein' | 'brown' | 'black' | 'cream'
const COATS: readonly CowCoat[] = ['holstein', 'brown', 'black', 'cream']

export interface Point2 { x: number; z: number }

export interface HerdAgent {
  id: string
  kind: TrackedEntity['kind']
  name: string
  lotId: string
  cameraId: string
  coat: CowCoat
  role: 'worker' | 'visitor'
  position: Point2
  target: Point2
  heading: number
  /** Current ground speed, units per second; drives the walk cycle. */
  speed: number
  state: 'grazing' | 'walking' | 'returning'
  /** Never set by live data; kept for the shared cow model's gait. */
  escapeRequested: boolean
  outside: boolean
  confidence: number | null
  source: TrackedEntity['source']
  /** 0 → 1 on arrival, 1 → 0 while leaving. */
  presence: number
  leaving: boolean
  /** Seconds since the agent appeared; the arrival ring uses it. */
  age: number
}

export interface MotionConfig {
  /** Maps plan coordinates to the space the agents move in (world metres for 3D, plan units for 2D). */
  toSpace: (point: { x: number; y: number }) => Point2
  cowSpeed: number
  personSpeed: number
  /** Below this distance an agent stands still. */
  arriveRadius: number
}

export interface HerdMotion {
  agents: Map<string, HerdAgent>
  config: MotionConfig
  /** False until the first sync: the first herd appears in place instead of walking in. */
  seeded: boolean
}

const PRESENCE_RATE = 7
const TURN_RATE = 5

export function createHerdMotion(config: MotionConfig): HerdMotion {
  return { agents: new Map(), config, seeded: false }
}

function agentName(entity: TrackedEntity): string {
  if (entity.kind === 'person') return entity.trackId === null ? 'Persona' : `Persona #${entity.trackId}`
  if (entity.kind === 'other') return entity.label
  return entity.trackId === null ? 'Vaca' : `Vaca #${entity.trackId}`
}

/** Applies the latest tracked entities: new ones appear, known ones get a new target, missing ones leave. */
export function syncHerd(motion: HerdMotion, entities: readonly TrackedEntity[], { instant = false } = {}): void {
  const seen = new Set<string>()
  for (const entity of entities) {
    seen.add(entity.id)
    const target = motion.config.toSpace(entity.target)
    const agent = motion.agents.get(entity.id)
    if (agent) {
      Object.assign(agent, {
        target, outside: entity.outside, confidence: entity.confidence, lotId: entity.lotId, leaving: false, source: entity.source,
      })
      if (instant) agent.position = { ...target }
      continue
    }
    motion.agents.set(entity.id, {
      id: entity.id, kind: entity.kind, name: agentName(entity), lotId: entity.lotId, cameraId: entity.cameraId,
      coat: COATS[Math.floor(unitHash(entity.id, 3) * COATS.length)],
      role: unitHash(entity.id, 4) < 0.5 ? 'visitor' : 'worker',
      position: { ...target }, target, heading: unitHash(entity.id, 5) * Math.PI * 2 - Math.PI, speed: 0,
      state: 'grazing', escapeRequested: false, outside: entity.outside, confidence: entity.confidence,
      source: entity.source, presence: !motion.seeded || instant ? 1 : 0, leaving: false, age: motion.seeded ? 0 : 10,
    })
  }
  for (const agent of motion.agents.values()) {
    if (!seen.has(agent.id)) {
      if (instant) motion.agents.delete(agent.id)
      else agent.leaving = true
    }
  }
  motion.seeded = true
}

const shortestTurn = (delta: number) => Math.atan2(Math.sin(delta), Math.cos(delta))

/** Advances every agent by `dt` seconds. Returns true when an agent was removed. */
export function stepHerd(motion: HerdMotion, dt: number, { reduceMotion = false } = {}): boolean {
  const { arriveRadius, cowSpeed, personSpeed } = motion.config
  let removed = false
  for (const agent of motion.agents.values()) {
    agent.age += dt
    const presenceGoal = agent.leaving ? 0 : 1
    agent.presence = reduceMotion ? presenceGoal : agent.presence + (presenceGoal - agent.presence) * (1 - Math.exp(-dt * PRESENCE_RATE))
    if (agent.leaving && agent.presence < 0.02) {
      motion.agents.delete(agent.id)
      removed = true
      continue
    }

    const dx = agent.target.x - agent.position.x
    const dz = agent.target.z - agent.position.z
    const distance = Math.hypot(dx, dz)
    if (reduceMotion) {
      // Reduced motion: no walking, the animal is simply where the camera saw it.
      agent.position = { ...agent.target }
      agent.speed = 0
      agent.state = 'grazing'
      continue
    }
    if (distance <= arriveRadius) {
      agent.speed += (0 - agent.speed) * (1 - Math.exp(-dt * 6))
      agent.state = 'grazing'
      continue
    }
    const pace = agent.kind === 'person' ? personSpeed : cowSpeed
    // Farther targets are walked faster (a lagging box catches up). An animal the AI already calls
    // outside hurries more, so the scene matches the verdict within a second or two.
    const cap = agent.outside ? 4 : 2.2
    const desired = Math.min(pace * cap, pace * (0.6 + distance / (arriveRadius * 12)))
    agent.speed += (desired - agent.speed) * (1 - Math.exp(-dt * 4))
    const step = Math.min(distance, agent.speed * dt)
    agent.position = { x: agent.position.x + (dx / distance) * step, z: agent.position.z + (dz / distance) * step }
    const goal = Math.atan2(dz, dx)
    agent.heading += shortestTurn(goal - agent.heading) * (1 - Math.exp(-dt * TURN_RATE))
    agent.state = agent.outside ? 'returning' : 'walking'
  }
  return removed
}
