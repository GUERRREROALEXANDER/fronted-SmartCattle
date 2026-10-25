import type { FarmPlan } from '../../../mocks/mockFarmPlan'
import {
  closestPointOnPolygon,
  distanceToPolygonBoundary,
  planToWorld,
  pointAlongPolyline,
  pointInPolygon,
  polygonInteriorPoint,
  polylineLength,
  polylineTangent,
  randomPointInPolygon,
  type WorldPoint,
} from './geometry'
import { randomRange, type Rng } from './rng'

export type CowCoat = 'holstein' | 'brown' | 'black' | 'cream'
export type CowMotionState = 'grazing' | 'walking' | 'returning'

export interface SimulationCow {
  id: string
  name: string
  lotId: string
  coat: CowCoat
  state: CowMotionState
  position: WorldPoint
  heading: number
  escaped: boolean
  target: WorldPoint
  speed: number
  stateTime: number
  escapeTime: number
  escapeRequested: boolean
}

export type PersonRole = 'worker' | 'visitor'

export interface SimulationPerson {
  id: string
  role: PersonRole
  position: WorldPoint
  heading: number
  speed: number
  distance: number
  direction: 1 | -1
}

export interface SimulationLot {
  id: string
  name: string
  boundary: readonly WorldPoint[]
}

export interface HerdSimulation {
  lots: readonly SimulationLot[]
  cows: SimulationCow[]
  people: SimulationPerson[]
  track: readonly WorldPoint[]
  elapsed: number
  randomEscapes: boolean
}

export interface HerdEvent {
  type: 'exit' | 'return'
  cowId: string
  cowName: string
  lotId: string
  at: number
}

export interface ZoneSummary {
  lotId: string
  lotName: string
  total: number
  inside: number
  outside: number
  breached: boolean
}

const DEFAULT_COWS_PER_LOT = 6
const MIN_COWS_PER_LOT = 5
const MAX_COWS_PER_LOT = 8
const MAX_SUBSTEP_SECONDS = 0.05
const MAX_DT_SECONDS = 10
const TURN_RATE = 3.8
const GRAZING_SECONDS = 3.5
const MAX_WALK_SECONDS = 18
const ESCAPE_DURATION_SECONDS = 6
const ESCAPE_CLEARANCE = 1.25
const RANDOM_ESCAPE_RATE = 0.00008
const COATS: readonly CowCoat[] = ['holstein', 'brown', 'black', 'cream']
const PERSON_ROLES: readonly PersonRole[] = ['worker', 'visitor', 'worker']

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function distance(a: WorldPoint, b: WorldPoint): number {
  return Math.hypot(a.x - b.x, a.z - b.z)
}

function normalizeAngle(angle: number): number {
  return Math.atan2(Math.sin(angle), Math.cos(angle))
}

function normalizedCowCount(count: number | undefined): number {
  if (count === undefined || !Number.isFinite(count)) {
    return DEFAULT_COWS_PER_LOT
  }
  return clamp(Math.trunc(count), MIN_COWS_PER_LOT, MAX_COWS_PER_LOT)
}

function interiorMargin(boundary: readonly WorldPoint[]): number {
  if (boundary.length === 0) {
    return 0.5
  }

  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minZ = Number.POSITIVE_INFINITY
  let maxZ = Number.NEGATIVE_INFINITY

  for (const point of boundary) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minZ = Math.min(minZ, point.z)
    maxZ = Math.max(maxZ, point.z)
  }

  const shortestSide = Math.min(maxX - minX, maxZ - minZ)
  return Math.max(0.05, Math.min(1.25, shortestSide * 0.12))
}

function randomLotPoint(boundary: readonly WorldPoint[], rng: Rng): WorldPoint {
  const margin = interiorMargin(boundary)
  const fallback = polygonInteriorPoint(boundary)
  let bestPoint = fallback
  let bestClearance = pointInPolygon(fallback, boundary)
    ? distanceToPolygonBoundary(fallback, boundary)
    : 0

  for (let attempt = 0; attempt < 64; attempt += 1) {
    const candidate = randomPointInPolygon(boundary, rng)
    if (!pointInPolygon(candidate, boundary)) {
      continue
    }

    const clearance = distanceToPolygonBoundary(candidate, boundary)
    if (clearance > bestClearance) {
      bestPoint = candidate
      bestClearance = clearance
    }
    if (clearance >= margin) {
      return candidate
    }
  }

  return bestPoint
}

function interiorTarget(boundary: readonly WorldPoint[], rng: Rng): WorldPoint {
  const center = polygonInteriorPoint(boundary)
  if (
    pointInPolygon(center, boundary)
    && distanceToPolygonBoundary(center, boundary) >= interiorMargin(boundary)
  ) {
    return center
  }
  return randomLotPoint(boundary, rng)
}

function createPeople(track: readonly WorldPoint[], rng: Rng): SimulationPerson[] {
  const length = polylineLength(track)
  if (track.length < 2 || length <= 0) {
    return []
  }

  return PERSON_ROLES.map((role, index) => {
    const distanceAlongTrack = (length * (index + 1)) / (PERSON_ROLES.length + 1)
    const direction = index % 2 === 0 ? 1 as const : -1 as const
    const tangent = polylineTangent(track, distanceAlongTrack)
    return {
      id: `person-${String(index + 1).padStart(2, '0')}`,
      role,
      position: pointAlongPolyline(track, distanceAlongTrack),
      heading: Math.atan2(tangent.z * direction, tangent.x * direction),
      speed: randomRange(rng, 0.75, 1.15),
      distance: distanceAlongTrack,
      direction,
    }
  })
}

export function createHerdSimulation(
  plan: FarmPlan,
  rng: Rng,
  options: { cowsPerLot?: number; randomEscapes?: boolean } = {},
): HerdSimulation {
  const lots: SimulationLot[] = plan.lots.map(lot => ({
    id: lot.id,
    name: lot.name,
    boundary: lot.boundary.map(point => planToWorld(point, plan.width, plan.height)),
  }))
  const track = plan.track.map(point => planToWorld(point, plan.width, plan.height))
  const cows: SimulationCow[] = []
  const cowsPerLot = normalizedCowCount(options.cowsPerLot)

  for (const lot of lots) {
    for (let index = 0; index < cowsPerLot; index += 1) {
      const serial = String(cows.length + 1).padStart(2, '0')
      const state: CowMotionState = rng() < 0.55 ? 'grazing' : 'walking'
      cows.push({
        id: `cow-${serial}`,
        name: `Vaca ${serial}`,
        lotId: lot.id,
        coat: COATS[Math.floor(rng() * COATS.length)],
        state,
        position: randomLotPoint(lot.boundary, rng),
        heading: randomRange(rng, -Math.PI, Math.PI),
        escaped: false,
        target: randomLotPoint(lot.boundary, rng),
        speed: randomRange(rng, 0.65, 1.1),
        stateTime: randomRange(rng, 0, 2),
        escapeTime: 0,
        escapeRequested: false,
      })
    }
  }

  return {
    lots,
    cows,
    people: createPeople(track, rng),
    track,
    elapsed: 0,
    randomEscapes: options.randomEscapes ?? true,
  }
}

function outsideEscapeTarget(cow: SimulationCow, boundary: readonly WorldPoint[]): WorldPoint {
  const boundaryPoint = closestPointOnPolygon(cow.position, boundary)
  const center = polygonInteriorPoint(boundary)
  let dx = boundaryPoint.x - cow.position.x
  let dz = boundaryPoint.z - cow.position.z
  let length = Math.hypot(dx, dz)

  if (length <= 1e-9) {
    dx = boundaryPoint.x - center.x
    dz = boundaryPoint.z - center.z
    length = Math.hypot(dx, dz)
  }
  if (length <= 1e-9) {
    dx = 1
    dz = 0
    length = 1
  }

  const primaryTarget = {
    x: boundaryPoint.x + (dx / length) * ESCAPE_CLEARANCE,
    z: boundaryPoint.z + (dz / length) * ESCAPE_CLEARANCE,
  }
  if (!pointInPolygon(primaryTarget, boundary)) {
    return primaryTarget
  }

  for (let index = 0; index < 16; index += 1) {
    const angle = (index / 16) * Math.PI * 2
    const candidate = {
      x: boundaryPoint.x + Math.cos(angle) * ESCAPE_CLEARANCE,
      z: boundaryPoint.z + Math.sin(angle) * ESCAPE_CLEARANCE,
    }
    if (!pointInPolygon(candidate, boundary)) {
      return candidate
    }
  }

  return primaryTarget
}

function requestEscape(cow: SimulationCow, lot: SimulationLot): boolean {
  if (cow.escaped || cow.escapeRequested || !pointInPolygon(cow.position, lot.boundary)) {
    return false
  }

  cow.escapeRequested = true
  cow.escapeTime = 0
  cow.state = 'walking'
  cow.stateTime = 0
  cow.target = outsideEscapeTarget(cow, lot.boundary)
  return true
}

export function forceEscape(simulation: HerdSimulation, cowIdOrLotId: string, rng: Rng): boolean {
  const requestedCow = simulation.cows.find(cow => cow.id === cowIdOrLotId)
  let cow = requestedCow

  if (!cow) {
    const eligibleCows = simulation.cows.filter(candidate => {
      if (candidate.lotId !== cowIdOrLotId || candidate.escaped || candidate.escapeRequested) {
        return false
      }
      const lot = simulation.lots.find(item => item.id === candidate.lotId)
      return lot !== undefined && pointInPolygon(candidate.position, lot.boundary)
    })
    if (eligibleCows.length > 0) {
      cow = eligibleCows[Math.floor(rng() * eligibleCows.length)]
    }
  }

  if (!cow) {
    return false
  }

  const lot = simulation.lots.find(item => item.id === cow.lotId)
  return lot !== undefined && requestEscape(cow, lot)
}

/** Moves a cow with a pending escape straight to its outside target (paused or reduced-motion demo). */
export function jumpToEscapeTarget(simulation: HerdSimulation, cowId: string): boolean {
  const cow = simulation.cows.find(candidate => candidate.id === cowId)
  if (!cow || !cow.escapeRequested) {
    return false
  }
  cow.heading = Math.atan2(cow.target.z - cow.position.z, cow.target.x - cow.position.x)
  cow.position = { x: cow.target.x, z: cow.target.z }
  return true
}

function steerCow(cow: SimulationCow, dt: number, speedMultiplier: number): WorldPoint {
  const dx = cow.target.x - cow.position.x
  const dz = cow.target.z - cow.position.z
  const targetDistance = Math.hypot(dx, dz)
  if (targetDistance <= 1e-9) {
    return cow.position
  }

  const desiredHeading = Math.atan2(dz, dx)
  const headingChange = clamp(
    normalizeAngle(desiredHeading - cow.heading),
    -TURN_RATE * dt,
    TURN_RATE * dt,
  )
  cow.heading = normalizeAngle(cow.heading + headingChange)

  const alignment = Math.max(0, Math.cos(normalizeAngle(desiredHeading - cow.heading)))
  const travel = Math.min(targetDistance, cow.speed * speedMultiplier * alignment * dt)
  return {
    x: cow.position.x + Math.cos(cow.heading) * travel,
    z: cow.position.z + Math.sin(cow.heading) * travel,
  }
}

function updateNormalCow(cow: SimulationCow, lot: SimulationLot, dt: number, rng: Rng): void {
  cow.stateTime += dt

  if (cow.state === 'grazing') {
    if (cow.stateTime >= GRAZING_SECONDS) {
      cow.state = 'walking'
      cow.stateTime = 0
      cow.target = randomLotPoint(lot.boundary, rng)
    }
    return
  }

  cow.state = 'walking'
  const margin = interiorMargin(lot.boundary)
  const boundaryDistance = distanceToPolygonBoundary(cow.position, lot.boundary)
  if (boundaryDistance < margin * 0.75 || !pointInPolygon(cow.target, lot.boundary)) {
    cow.target = interiorTarget(lot.boundary, rng)
  }

  if (distance(cow.position, cow.target) < 0.25 || cow.stateTime >= MAX_WALK_SECONDS) {
    cow.state = 'grazing'
    cow.stateTime = 0
    return
  }

  const candidate = steerCow(cow, dt, 1)
  if (pointInPolygon(candidate, lot.boundary)) {
    cow.position = candidate
  } else {
    cow.target = interiorTarget(lot.boundary, rng)
  }
}

function updateRequestedEscape(cow: SimulationCow, dt: number): void {
  cow.stateTime += dt
  cow.position = steerCow(cow, dt, 1.35)
}

function updateEscapedCow(cow: SimulationCow, lot: SimulationLot, dt: number, rng: Rng): void {
  cow.escapeTime += dt
  cow.stateTime += dt

  if (cow.state !== 'returning') {
    if (cow.escapeTime < ESCAPE_DURATION_SECONDS) {
      return
    }
    cow.state = 'returning'
    cow.stateTime = 0
    cow.target = randomLotPoint(lot.boundary, rng)
  }

  cow.position = steerCow(cow, dt, 1.2)
}

function herdEvent(type: HerdEvent['type'], cow: SimulationCow, at: number): HerdEvent {
  return { type, cowId: cow.id, cowName: cow.name, lotId: cow.lotId, at }
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

function advancePeople(simulation: HerdSimulation, dt: number): void {
  const length = polylineLength(simulation.track)
  if (length <= 0) {
    return
  }

  const cycleLength = length * 2
  for (const person of simulation.people) {
    const phase = person.direction === 1 ? person.distance : cycleLength - person.distance
    const nextPhase = positiveModulo(phase + person.speed * dt, cycleLength)

    if (nextPhase < length) {
      person.distance = nextPhase
      person.direction = 1
    } else {
      person.distance = cycleLength - nextPhase
      person.direction = -1
    }

    person.position = pointAlongPolyline(simulation.track, person.distance)
    const tangent = polylineTangent(simulation.track, person.distance)
    person.heading = Math.atan2(tangent.z * person.direction, tangent.x * person.direction)
  }
}

export function step(simulation: HerdSimulation, dt: number, rng: Rng): HerdEvent[] {
  if (!Number.isFinite(dt) || dt <= 0) {
    return []
  }

  const clampedDt = Math.min(dt, MAX_DT_SECONDS)
  const substeps = Math.max(1, Math.ceil(clampedDt / MAX_SUBSTEP_SECONDS))
  const substepDt = clampedDt / substeps
  const events: HerdEvent[] = []
  const lotsById = new Map(simulation.lots.map(lot => [lot.id, lot]))

  for (let substep = 0; substep < substeps; substep += 1) {
    simulation.elapsed += substepDt
    advancePeople(simulation, substepDt)

    for (const cow of simulation.cows) {
      const lot = lotsById.get(cow.lotId)
      if (!lot) {
        continue
      }

      if (cow.escaped) {
        updateEscapedCow(cow, lot, substepDt, rng)
      } else {
        if (
          simulation.randomEscapes
          && !cow.escapeRequested
          && rng() < 1 - Math.exp(-RANDOM_ESCAPE_RATE * substepDt)
        ) {
          requestEscape(cow, lot)
        }

        if (cow.escapeRequested) {
          updateRequestedEscape(cow, substepDt)
        } else {
          updateNormalCow(cow, lot, substepDt, rng)
        }
      }

      const inside = pointInPolygon(cow.position, lot.boundary)
      if (!cow.escaped && !inside) {
        cow.escaped = true
        cow.escapeRequested = false
        cow.escapeTime = 0
        cow.state = 'grazing'
        cow.stateTime = 0
        events.push(herdEvent('exit', cow, simulation.elapsed))
      } else if (cow.escaped && cow.state === 'returning' && inside) {
        cow.escaped = false
        cow.escapeRequested = false
        cow.escapeTime = 0
        cow.state = 'walking'
        cow.stateTime = 0
        events.push(herdEvent('return', cow, simulation.elapsed))
      }
    }
  }

  return events
}

export function getZoneSummaries(simulation: HerdSimulation): ZoneSummary[] {
  return simulation.lots.map(lot => {
    let inside = 0
    let outside = 0

    for (const cow of simulation.cows) {
      if (cow.lotId !== lot.id) {
        continue
      }
      if (pointInPolygon(cow.position, lot.boundary)) {
        inside += 1
      } else {
        outside += 1
      }
    }

    return {
      lotId: lot.id,
      lotName: lot.name,
      total: inside + outside,
      inside,
      outside,
      breached: outside > 0,
    }
  })
}
