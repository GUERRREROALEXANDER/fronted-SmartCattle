import type { FarmPlan, PlanPoint } from '../../services'
import type { Rng } from '../pasture3d/simulation/rng'

export type CowMode = 'grazing' | 'walking' | 'escaping' | 'outside' | 'returning'

export interface LiveZone {
  id: string
  name: string
  boundary: readonly PlanPoint[]
}

export interface LiveCow {
  id: string
  tag: number
  zoneId: string
  position: PlanPoint
  target: PlanPoint
  heading: number
  speed: number
  mode: CowMode
  modeTime: number
  restSeconds: number
  outside: boolean
  outsideTime: number
}

export interface LivePerson {
  id: string
  position: PlanPoint
  heading: number
  speed: number
  distance: number
  direction: 1 | -1
}

interface DetectionBucket {
  at: number
  count: number
}

export interface LiveHerdState {
  zones: readonly LiveZone[]
  cows: LiveCow[]
  people: LivePerson[]
  track: readonly PlanPoint[]
  elapsed: number
  alertCount: number
  zoneAlerts: Record<string, number>
  detectionTotal: number
  detectionCredit: number
  detectionWindow: DetectionBucket[]
  nextRandomExit: number
  randomEscapes: boolean
}

export interface LiveHerdEvent {
  type: 'exit' | 'return'
  cowId: string
  tag: number
  zoneId: string
  zoneName: string
  at: number
}

export interface LiveCowSnapshot {
  id: string
  tag: number
  zoneId: string
  zoneName: string
  position: PlanPoint
  heading: number
  outside: boolean
}

export interface LivePersonSnapshot {
  id: string
  position: PlanPoint
  heading: number
}

export interface LiveZoneSnapshot {
  id: string
  name: string
  total: number
  inside: number
  outside: number
  alerts: number
}

export interface LiveHerdSnapshot {
  elapsed: number
  sampleAt: number
  cows: LiveCowSnapshot[]
  people: LivePersonSnapshot[]
  zones: LiveZoneSnapshot[]
  insideCount: number
  totalCount: number
  insidePercentage: number
  alertCount: number
  detectionsPerMinute: number
  peopleCount: number
}

export interface LiveSessionDeltas {
  insideCount: number
  insidePercentage: number
  alertCount: number
  detectionsPerMinute: number
  peopleCount: number
}

export interface LiveChartPoint {
  sampleAt: number
  label: string
  insidePercentage: number
  detections: number
}

export interface LiveHerdOptions {
  cowsPerZone?: number
  randomEscapes?: boolean
}

const MAX_DT = 1
const MAX_SUBSTEP = 0.05
const OUTSIDE_SECONDS = 6
const ESCAPE_CLEARANCE = 24
const DETECTIONS_PER_ENTITY_SECOND = 0.09
const DETECTION_WINDOW_SECONDS = 10
const CHART_WINDOW_SECONDS = 60

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value))
const randomRange = (rng: Rng, min: number, max: number) => min + (max - min) * rng()
const distance = (a: PlanPoint, b: PlanPoint) => Math.hypot(a.x - b.x, a.y - b.y)

export function pointInPolygon(point: PlanPoint, polygon: readonly PlanPoint[]): boolean {
  if (polygon.length < 3) return false
  let inside = false
  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]
    const end = polygon[(index + 1) % polygon.length]
    const crosses = (start.y > point.y) !== (end.y > point.y)
    if (crosses) {
      const intersectionX = start.x + ((point.y - start.y) * (end.x - start.x)) / (end.y - start.y)
      if (point.x < intersectionX) inside = !inside
    }
  }
  return inside
}

function centroid(polygon: readonly PlanPoint[]): PlanPoint {
  const total = polygon.reduce((sum, point) => ({ x: sum.x + point.x, y: sum.y + point.y }), { x: 0, y: 0 })
  return { x: total.x / polygon.length, y: total.y / polygon.length }
}

function randomPointInPolygon(polygon: readonly PlanPoint[], rng: Rng): PlanPoint {
  const xs = polygon.map(point => point.x)
  const ys = polygon.map(point => point.y)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minY = Math.min(...ys)
  const maxY = Math.max(...ys)
  for (let attempt = 0; attempt < 128; attempt += 1) {
    const candidate = { x: randomRange(rng, minX, maxX), y: randomRange(rng, minY, maxY) }
    if (pointInPolygon(candidate, polygon)) return candidate
  }
  return centroid(polygon)
}

function closestPointOnSegment(point: PlanPoint, start: PlanPoint, end: PlanPoint): PlanPoint {
  const dx = end.x - start.x
  const dy = end.y - start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return { ...start }
  const t = clamp(((point.x - start.x) * dx + (point.y - start.y) * dy) / lengthSquared, 0, 1)
  return { x: start.x + t * dx, y: start.y + t * dy }
}

function closestBoundaryPoint(point: PlanPoint, polygon: readonly PlanPoint[]): PlanPoint {
  let closest = polygon[0]
  let bestDistance = Number.POSITIVE_INFINITY
  for (let index = 0; index < polygon.length; index += 1) {
    const candidate = closestPointOnSegment(point, polygon[index], polygon[(index + 1) % polygon.length])
    const candidateDistance = distance(point, candidate)
    if (candidateDistance < bestDistance) {
      closest = candidate
      bestDistance = candidateDistance
    }
  }
  return closest
}

function outsideTarget(cow: LiveCow, zone: LiveZone): PlanPoint {
  const boundary = closestBoundaryPoint(cow.position, zone.boundary)
  const center = centroid(zone.boundary)
  const dx = boundary.x - center.x
  const dy = boundary.y - center.y
  const length = Math.hypot(dx, dy) || 1
  const primary = {
    x: boundary.x + (dx / length) * ESCAPE_CLEARANCE,
    y: boundary.y + (dy / length) * ESCAPE_CLEARANCE,
  }
  if (!pointInPolygon(primary, zone.boundary)) return primary
  for (let index = 0; index < 16; index += 1) {
    const angle = index * Math.PI / 8
    const candidate = {
      x: boundary.x + Math.cos(angle) * ESCAPE_CLEARANCE,
      y: boundary.y + Math.sin(angle) * ESCAPE_CLEARANCE,
    }
    if (!pointInPolygon(candidate, zone.boundary)) return candidate
  }
  return primary
}

function polylineLength(track: readonly PlanPoint[]): number {
  let length = 0
  for (let index = 0; index < track.length - 1; index += 1) length += distance(track[index], track[index + 1])
  return length
}

function pointAlongPolyline(track: readonly PlanPoint[], targetDistance: number): PlanPoint {
  let remaining = clamp(targetDistance, 0, polylineLength(track))
  for (let index = 0; index < track.length - 1; index += 1) {
    const start = track[index]
    const end = track[index + 1]
    const segmentLength = distance(start, end)
    if (remaining <= segmentLength) {
      const t = segmentLength === 0 ? 0 : remaining / segmentLength
      return { x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t }
    }
    remaining -= segmentLength
  }
  return { ...(track[track.length - 1] ?? { x: 0, y: 0 }) }
}

function tangentAlongPolyline(track: readonly PlanPoint[], targetDistance: number): PlanPoint {
  let traversed = 0
  for (let index = 0; index < track.length - 1; index += 1) {
    const start = track[index]
    const end = track[index + 1]
    const segmentLength = distance(start, end)
    if (targetDistance <= traversed + segmentLength) {
      return { x: (end.x - start.x) / (segmentLength || 1), y: (end.y - start.y) / (segmentLength || 1) }
    }
    traversed += segmentLength
  }
  return { x: 1, y: 0 }
}

function createPeople(track: readonly PlanPoint[], rng: Rng): LivePerson[] {
  const length = polylineLength(track)
  if (track.length < 2 || length === 0) return []
  return [0, 1, 2].map(index => {
    const personDistance = length * (index + 1) / 4
    const direction = index % 2 === 0 ? 1 as const : -1 as const
    const tangent = tangentAlongPolyline(track, personDistance)
    return {
      id: `person-${index + 1}`,
      position: pointAlongPolyline(track, personDistance),
      heading: Math.atan2(tangent.y * direction, tangent.x * direction),
      speed: randomRange(rng, 12, 19),
      distance: personDistance,
      direction,
    }
  })
}

export function createLiveHerd(plan: FarmPlan, rng: Rng, options: LiveHerdOptions = {}): LiveHerdState {
  const zones = plan.lots.map(lot => ({ id: lot.id, name: lot.name, boundary: lot.boundary }))
  const cowsPerZone = clamp(Math.trunc(options.cowsPerZone ?? 5), 1, 12)
  const cows: LiveCow[] = []
  for (const zone of zones) {
    for (let index = 0; index < cowsPerZone; index += 1) {
      const position = randomPointInPolygon(zone.boundary, rng)
      const tag = cows.length + 1
      cows.push({
        id: `cow-${String(tag).padStart(2, '0')}`,
        tag,
        zoneId: zone.id,
        position,
        target: randomPointInPolygon(zone.boundary, rng),
        heading: randomRange(rng, -Math.PI, Math.PI),
        speed: randomRange(rng, 12, 21),
        mode: rng() < 0.45 ? 'grazing' : 'walking',
        modeTime: 0,
        restSeconds: randomRange(rng, 1.5, 4),
        outside: false,
        outsideTime: 0,
      })
    }
  }
  return {
    zones,
    cows,
    people: createPeople(plan.track, rng),
    track: plan.track,
    elapsed: 0,
    alertCount: 0,
    zoneAlerts: Object.fromEntries(zones.map(zone => [zone.id, 0])),
    detectionTotal: 0,
    detectionCredit: 0,
    detectionWindow: [],
    nextRandomExit: randomRange(rng, 20, 40),
    randomEscapes: options.randomEscapes ?? true,
  }
}

function requestExit(cow: LiveCow, zone: LiveZone): boolean {
  if (cow.outside || cow.mode === 'escaping' || cow.mode === 'returning') return false
  cow.mode = 'escaping'
  cow.modeTime = 0
  cow.target = outsideTarget(cow, zone)
  return true
}

export function forceCowExit(state: LiveHerdState, rng: Rng, cowId?: string): string | null {
  const requested = cowId ? state.cows.find(cow => cow.id === cowId) : undefined
  const eligible = state.cows.filter(cow => !cow.outside && cow.mode !== 'escaping' && cow.mode !== 'returning')
  const cow = requested && eligible.includes(requested)
    ? requested
    : eligible.length > 0 ? eligible[Math.floor(rng() * eligible.length)] : undefined
  if (!cow) return null
  const zone = state.zones.find(item => item.id === cow.zoneId)
  return zone && requestExit(cow, zone) ? cow.id : null
}

export function jumpCowOutside(state: LiveHerdState, cowId: string): boolean {
  const cow = state.cows.find(item => item.id === cowId)
  if (!cow || cow.mode !== 'escaping') return false
  cow.heading = Math.atan2(cow.target.y - cow.position.y, cow.target.x - cow.position.x)
  cow.position = { ...cow.target }
  return true
}

function moveTowardTarget(cow: LiveCow, dt: number, multiplier: number): void {
  const dx = cow.target.x - cow.position.x
  const dy = cow.target.y - cow.position.y
  const remaining = Math.hypot(dx, dy)
  if (remaining < 0.001) return
  cow.heading = Math.atan2(dy, dx)
  const ramp = Math.min(1, 0.25 + cow.modeTime * 1.5)
  const travel = Math.min(remaining, cow.speed * multiplier * ramp * dt)
  cow.position = { x: cow.position.x + dx / remaining * travel, y: cow.position.y + dy / remaining * travel }
}

function updateCow(cow: LiveCow, zone: LiveZone, dt: number, rng: Rng): void {
  cow.modeTime += dt
  if (cow.mode === 'grazing') {
    if (cow.modeTime >= cow.restSeconds) {
      cow.mode = 'walking'
      cow.modeTime = 0
      cow.target = randomPointInPolygon(zone.boundary, rng)
    }
    return
  }
  if (cow.mode === 'outside') {
    cow.outsideTime += dt
    // Keep walking past the fence so the cow is visibly outside, not perched on the line.
    moveTowardTarget(cow, dt, 1)
    if (cow.outsideTime >= OUTSIDE_SECONDS) {
      cow.mode = 'returning'
      cow.modeTime = 0
      cow.target = randomPointInPolygon(zone.boundary, rng)
    }
    return
  }
  moveTowardTarget(cow, dt, cow.mode === 'escaping' ? 2 : cow.mode === 'returning' ? 1.4 : 1)
  if (cow.mode === 'walking' && distance(cow.position, cow.target) < 1) {
    cow.mode = 'grazing'
    cow.modeTime = 0
    cow.restSeconds = randomRange(rng, 1.5, 4)
  }
}

function positiveModulo(value: number, divisor: number): number {
  return ((value % divisor) + divisor) % divisor
}

function advancePeople(state: LiveHerdState, dt: number): void {
  const length = polylineLength(state.track)
  if (length === 0) return
  const cycleLength = length * 2
  for (const person of state.people) {
    const phase = person.direction === 1 ? person.distance : cycleLength - person.distance
    const nextPhase = positiveModulo(phase + person.speed * dt, cycleLength)
    person.direction = nextPhase < length ? 1 : -1
    person.distance = nextPhase < length ? nextPhase : cycleLength - nextPhase
    person.position = pointAlongPolyline(state.track, person.distance)
    const tangent = tangentAlongPolyline(state.track, person.distance)
    person.heading = Math.atan2(tangent.y * person.direction, tangent.x * person.direction)
  }
}

function recordDetections(state: LiveHerdState, dt: number): void {
  state.detectionCredit += (state.cows.length + state.people.length) * DETECTIONS_PER_ENTITY_SECOND * dt
  const count = Math.floor(state.detectionCredit)
  state.detectionCredit -= count
  state.detectionTotal += count
  if (count > 0) state.detectionWindow.push({ at: state.elapsed, count })
  state.detectionWindow = state.detectionWindow.filter(bucket => bucket.at >= state.elapsed - DETECTION_WINDOW_SECONDS)
}

export function stepLiveHerd(state: LiveHerdState, dt: number, rng: Rng): LiveHerdEvent[] {
  if (!Number.isFinite(dt) || dt <= 0) return []
  const clampedDt = Math.min(dt, MAX_DT)
  const substeps = Math.max(1, Math.ceil(clampedDt / MAX_SUBSTEP))
  const substepDt = clampedDt / substeps
  const events: LiveHerdEvent[] = []
  const zonesById = new Map(state.zones.map(zone => [zone.id, zone]))

  for (let substep = 0; substep < substeps; substep += 1) {
    state.elapsed += substepDt
    advancePeople(state, substepDt)
    recordDetections(state, substepDt)

    if (state.randomEscapes && state.elapsed >= state.nextRandomExit) {
      const eligible = state.cows.filter(cow => !cow.outside && cow.mode !== 'escaping' && cow.mode !== 'returning')
      if (eligible.length > 0) {
        const cow = eligible[Math.floor(rng() * eligible.length)]
        const zone = zonesById.get(cow.zoneId)
        if (zone) requestExit(cow, zone)
      }
      state.nextRandomExit = state.elapsed + randomRange(rng, 20, 40)
    }

    for (const cow of state.cows) {
      const zone = zonesById.get(cow.zoneId)
      if (!zone) continue
      updateCow(cow, zone, substepDt, rng)
      const inside = pointInPolygon(cow.position, zone.boundary)
      if (!cow.outside && !inside) {
        cow.outside = true
        cow.outsideTime = 0
        cow.mode = 'outside'
        cow.modeTime = 0
        state.alertCount += 1
        state.zoneAlerts[cow.zoneId] = (state.zoneAlerts[cow.zoneId] ?? 0) + 1
        events.push({ type: 'exit', cowId: cow.id, tag: cow.tag, zoneId: zone.id, zoneName: zone.name, at: state.elapsed })
      } else if (cow.outside && cow.mode === 'returning' && inside) {
        cow.outside = false
        cow.outsideTime = 0
        cow.mode = 'walking'
        cow.modeTime = 0
        cow.target = randomPointInPolygon(zone.boundary, rng)
        events.push({ type: 'return', cowId: cow.id, tag: cow.tag, zoneId: zone.id, zoneName: zone.name, at: state.elapsed })
      }
    }
  }
  return events
}

export function getLiveHerdSnapshot(state: LiveHerdState): LiveHerdSnapshot {
  const zonesById = new Map(state.zones.map(zone => [zone.id, zone]))
  const zones = state.zones.map(zone => {
    const cows = state.cows.filter(cow => cow.zoneId === zone.id)
    const outside = cows.filter(cow => cow.outside).length
    return {
      id: zone.id,
      name: zone.name,
      total: cows.length,
      inside: cows.length - outside,
      outside,
      alerts: state.zoneAlerts[zone.id] ?? 0,
    }
  })
  const insideCount = zones.reduce((sum, zone) => sum + zone.inside, 0)
  const totalCount = state.cows.length
  const observedDetections = state.detectionWindow.reduce((sum, bucket) => sum + bucket.count, 0)
  const detectionSeconds = Math.min(DETECTION_WINDOW_SECONDS, Math.max(1, state.elapsed))
  return {
    elapsed: state.elapsed,
    sampleAt: Math.floor(state.elapsed),
    cows: state.cows.map(cow => ({
      id: cow.id,
      tag: cow.tag,
      zoneId: cow.zoneId,
      zoneName: zonesById.get(cow.zoneId)?.name ?? cow.zoneId,
      position: { ...cow.position },
      heading: cow.heading,
      outside: cow.outside,
    })),
    people: state.people.map(person => ({ id: person.id, position: { ...person.position }, heading: person.heading })),
    zones,
    insideCount,
    totalCount,
    insidePercentage: totalCount > 0 ? Math.round(insideCount * 100 / totalCount) : 0,
    alertCount: state.alertCount,
    detectionsPerMinute: Math.round(observedDetections * 60 / detectionSeconds),
    peopleCount: state.people.length,
  }
}

export function liveSessionDeltas(current: LiveHerdSnapshot, initial: LiveHerdSnapshot): LiveSessionDeltas {
  return {
    insideCount: current.insideCount - initial.insideCount,
    insidePercentage: current.insidePercentage - initial.insidePercentage,
    alertCount: current.alertCount - initial.alertCount,
    detectionsPerMinute: current.detectionsPerMinute - initial.detectionsPerMinute,
    peopleCount: current.peopleCount - initial.peopleCount,
  }
}

export function appendLiveChartPoint(
  points: readonly LiveChartPoint[],
  snapshot: LiveHerdSnapshot,
  label: string,
): LiveChartPoint[] {
  const point = {
    sampleAt: snapshot.sampleAt,
    label,
    insidePercentage: snapshot.insidePercentage,
    detections: snapshot.detectionsPerMinute,
  }
  if (points[points.length - 1]?.sampleAt === point.sampleAt) return [...points.slice(0, -1), point]
  return [...points, point].slice(-CHART_WINDOW_SECONDS)
}
