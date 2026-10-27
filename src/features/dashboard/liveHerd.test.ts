import { describe, expect, it } from 'vitest'
import type { FarmPlan } from '../../services'
import { mulberry32 } from '../pasture3d/simulation/rng'
import {
  appendLiveChartPoint,
  createLiveHerd,
  forceCowExit,
  getLiveHerdSnapshot,
  jumpCowOutside,
  liveSessionDeltas,
  pointInPolygon,
  stepLiveHerd,
  type LiveHerdEvent,
} from './liveHerd'

const plan: FarmPlan = {
  width: 200,
  height: 120,
  lots: [{
    id: 'lot-test',
    name: 'Lote de prueba',
    labelAt: { x: 100, y: 60 },
    boundary: [{ x: 20, y: 20 }, { x: 180, y: 20 }, { x: 180, y: 100 }, { x: 20, y: 100 }],
  }],
  cameras: [],
  track: [{ x: 0, y: 110 }, { x: 200, y: 110 }],
  contours: [],
}

function advanceUntil(
  state: ReturnType<typeof createLiveHerd>,
  predicate: (events: LiveHerdEvent[]) => boolean,
  maxSeconds = 30,
): LiveHerdEvent[] {
  const rng = mulberry32(22)
  const collected: LiveHerdEvent[] = []
  for (let elapsed = 0; elapsed < maxSeconds; elapsed += 0.1) {
    const events = stepLiveHerd(state, 0.1, rng)
    collected.push(...events)
    if (predicate(events)) return collected
  }
  throw new Error('Condition was not reached before the simulation timeout')
}

describe('live herd zone crossing', () => {
  it('contains normal targets and detects a forced exit and return', () => {
    const rng = mulberry32(7)
    const state = createLiveHerd(plan, rng, { cowsPerZone: 2, randomEscapes: false })
    expect(state.cows.every(cow => pointInPolygon(cow.position, state.zones[0].boundary))).toBe(true)

    expect(forceCowExit(state, rng, 'cow-01')).toBe('cow-01')
    expect(jumpCowOutside(state, 'cow-01')).toBe(true)
    const exitEvents = stepLiveHerd(state, 0.01, rng)
    expect(exitEvents).toHaveLength(1)
    expect(exitEvents[0]).toMatchObject({ type: 'exit', cowId: 'cow-01', tag: 1, zoneName: 'Lote de prueba' })

    const outsideSnapshot = getLiveHerdSnapshot(state)
    expect(outsideSnapshot).toMatchObject({ insideCount: 1, totalCount: 2, insidePercentage: 50, alertCount: 1 })
    expect(outsideSnapshot.zones[0]).toMatchObject({ inside: 1, outside: 1, alerts: 1 })
    expect(outsideSnapshot.cows.find(cow => cow.id === 'cow-01')?.outside).toBe(true)

    const returnEvents = advanceUntil(state, events => events.some(event => event.type === 'return'))
    expect([...exitEvents, ...returnEvents].filter(event => event.type === 'exit')).toHaveLength(1)
    expect(returnEvents.at(-1)).toMatchObject({ type: 'return', cowId: 'cow-01' })
    expect(getLiveHerdSnapshot(state)).toMatchObject({ insideCount: 2, insidePercentage: 100, alertCount: 1 })
  })

  it('counts one alert per crossing rather than one per frame outside', () => {
    const rng = mulberry32(11)
    const state = createLiveHerd(plan, rng, { cowsPerZone: 1, randomEscapes: false })
    forceCowExit(state, rng, 'cow-01')
    jumpCowOutside(state, 'cow-01')
    stepLiveHerd(state, 0.01, rng)
    for (let index = 0; index < 30; index += 1) stepLiveHerd(state, 0.1, rng)
    expect(state.alertCount).toBe(1)
    expect(state.zoneAlerts['lot-test']).toBe(1)
  })

  it('keeps an escaped cow walking clear of the fence instead of stopping on it', () => {
    const rng = mulberry32(5)
    const state = createLiveHerd(plan, rng, { cowsPerZone: 1, randomEscapes: false })
    forceCowExit(state, rng, 'cow-01')
    advanceUntil(state, events => events.some(event => event.type === 'exit'))
    for (let index = 0; index < 20; index += 1) stepLiveHerd(state, 0.1, rng)
    const { x, y } = state.cows[0].position
    const clearance = Math.max(20 - x, x - 180, 20 - y, y - 100)
    expect(state.cows[0].outside).toBe(true)
    expect(clearance).toBeGreaterThan(10)
  })

  it('schedules automatic crossings at a 20 to 40 second cadence', () => {
    const rng = mulberry32(19)
    const state = createLiveHerd(plan, rng, { cowsPerZone: 2 })
    expect(state.nextRandomExit).toBeGreaterThanOrEqual(20)
    expect(state.nextRandomExit).toBeLessThanOrEqual(40)
    const events = advanceUntil(state, events => events.some(event => event.type === 'exit'), 45)
    expect(events[0].at).toBeGreaterThanOrEqual(20)
    expect(events[0].at).toBeLessThan(45)
  })
})

describe('live herd metrics', () => {
  it('derives detection rate and signed changes from the session baseline', () => {
    const rng = mulberry32(31)
    const state = createLiveHerd(plan, rng, { cowsPerZone: 2, randomEscapes: false })
    const initial = getLiveHerdSnapshot(state)
    for (let index = 0; index < 100; index += 1) stepLiveHerd(state, 0.1, rng)
    const current = getLiveHerdSnapshot(state)
    expect(current.detectionsPerMinute).toBeGreaterThan(0)
    expect(current.peopleCount).toBe(3)
    expect(liveSessionDeltas({ ...current, alertCount: 2 }, initial)).toEqual({
      insideCount: 0,
      insidePercentage: 0,
      alertCount: 2,
      detectionsPerMinute: current.detectionsPerMinute,
      peopleCount: 0,
    })
  })

  it('keeps a fixed 60 second chart window and updates a partial second in place', () => {
    const rng = mulberry32(41)
    const state = createLiveHerd(plan, rng, { cowsPerZone: 1, randomEscapes: false })
    const snapshot = getLiveHerdSnapshot(state)
    let points: ReturnType<typeof appendLiveChartPoint> = []
    for (let second = 0; second < 65; second += 1) {
      points = appendLiveChartPoint(points, { ...snapshot, sampleAt: second }, `00:${String(second).padStart(2, '0')}`)
    }
    expect(points).toHaveLength(60)
    expect(points[0].sampleAt).toBe(5)
    expect(points.at(-1)?.sampleAt).toBe(64)
    points = appendLiveChartPoint(points, { ...snapshot, sampleAt: 64, insidePercentage: 75 }, 'ahora')
    expect(points).toHaveLength(60)
    expect(points.at(-1)).toMatchObject({ sampleAt: 64, insidePercentage: 75, label: 'ahora' })
  })
})
