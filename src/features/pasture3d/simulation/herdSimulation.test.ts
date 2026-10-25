import { describe, expect, it } from 'vitest'
import { mockFarmPlan, type FarmPlan } from '../../../mocks/mockFarmPlan'
import { pointInPolygon } from './geometry'
import {
  createHerdSimulation,
  forceEscape,
  getZoneSummaries,
  jumpToEscapeTarget,
  step,
  type HerdEvent,
  type HerdSimulation,
} from './herdSimulation'
import { mulberry32, type Rng } from './rng'

function advanceUntilEvent(
  simulation: HerdSimulation,
  rng: Rng,
  type: HerdEvent['type'],
  cowId: string,
): HerdEvent {
  for (let index = 0; index < 3_000; index += 1) {
    const events = step(simulation, 0.05, rng)
    const event = events.find(candidate => candidate.type === type && candidate.cowId === cowId)
    if (event) {
      return event
    }
  }
  throw new Error(`No ${type} event emitted for ${cowId}`)
}

describe('createHerdSimulation', () => {
  it('creates a repeatable herd with six cows per lot by default', () => {
    const first = createHerdSimulation(mockFarmPlan, mulberry32(112), { randomEscapes: false })
    const second = createHerdSimulation(mockFarmPlan, mulberry32(112), { randomEscapes: false })

    expect(first).toEqual(second)
    expect(first.cows).toHaveLength(mockFarmPlan.lots.length * 6)
    expect(first.cows.slice(0, 6).map(cow => cow.name)).toEqual([
      'Vaca 01',
      'Vaca 02',
      'Vaca 03',
      'Vaca 04',
      'Vaca 05',
      'Vaca 06',
    ])
    expect(new Set(first.cows.map(cow => cow.id)).size).toBe(first.cows.length)

    for (const lot of first.lots) {
      expect(first.cows.filter(cow => cow.lotId === lot.id)).toHaveLength(6)
    }
  })

  it('clamps the requested herd size to five through eight cows per lot', () => {
    const small = createHerdSimulation(mockFarmPlan, mulberry32(1), { cowsPerLot: 1 })
    const large = createHerdSimulation(mockFarmPlan, mulberry32(1), { cowsPerLot: 20 })

    for (const lot of small.lots) {
      expect(small.cows.filter(cow => cow.lotId === lot.id)).toHaveLength(5)
    }
    for (const lot of large.lots) {
      expect(large.cows.filter(cow => cow.lotId === lot.id)).toHaveLength(8)
    }
  })
})

describe('herd escapes', () => {
  it('detects a forced exit only after the cow crosses its boundary', () => {
    const rng = mulberry32(981)
    const simulation = createHerdSimulation(mockFarmPlan, rng, { randomEscapes: false })
    const cow = simulation.cows[0]
    const lot = simulation.lots.find(item => item.id === cow.lotId)!

    expect(forceEscape(simulation, cow.id, rng)).toBe(true)
    expect(cow.escapeRequested).toBe(true)
    expect(cow.escaped).toBe(false)
    expect(pointInPolygon(cow.target, lot.boundary)).toBe(false)

    const exit = advanceUntilEvent(simulation, rng, 'exit', cow.id)

    expect(exit).toMatchObject({ type: 'exit', cowId: cow.id, cowName: cow.name, lotId: lot.id })
    expect(exit.at).toBeCloseTo(simulation.elapsed)
    expect(cow.escaped).toBe(true)
    expect(cow.escapeRequested).toBe(false)
    expect(pointInPolygon(cow.position, lot.boundary)).toBe(false)
    expect(getZoneSummaries(simulation).find(summary => summary.lotId === lot.id)).toMatchObject({
      total: 6,
      inside: 5,
      outside: 1,
      breached: true,
    })
  })

  it('returns an escaped cow only after it re-enters and clears the breach', () => {
    const rng = mulberry32(2398)
    const simulation = createHerdSimulation(mockFarmPlan, rng, { randomEscapes: false })
    const cow = simulation.cows[0]
    const lot = simulation.lots.find(item => item.id === cow.lotId)!

    expect(forceEscape(simulation, cow.id, rng)).toBe(true)
    const exit = advanceUntilEvent(simulation, rng, 'exit', cow.id)
    const returnEvent = advanceUntilEvent(simulation, rng, 'return', cow.id)

    expect(returnEvent.at).toBeGreaterThanOrEqual(exit.at + 6)
    expect(returnEvent).toMatchObject({ type: 'return', cowId: cow.id, lotId: lot.id })
    expect(cow.escaped).toBe(false)
    expect(cow.escapeTime).toBe(0)
    expect(cow.state).toBe('walking')
    expect(pointInPolygon(cow.position, lot.boundary)).toBe(true)
    expect(getZoneSummaries(simulation).find(summary => summary.lotId === lot.id)).toMatchObject({
      total: 6,
      inside: 6,
      outside: 0,
      breached: false,
    })
  })

  it('jumps a requested escape straight outside so a paused scene still shows the breach', () => {
    const rng = mulberry32(44)
    const simulation = createHerdSimulation(mockFarmPlan, rng, { randomEscapes: false })
    const cow = simulation.cows[3]
    const lot = simulation.lots.find(item => item.id === cow.lotId)!

    expect(jumpToEscapeTarget(simulation, cow.id)).toBe(false)
    expect(forceEscape(simulation, cow.id, rng)).toBe(true)
    expect(jumpToEscapeTarget(simulation, cow.id)).toBe(true)
    expect(pointInPolygon(cow.position, lot.boundary)).toBe(false)

    const events = step(simulation, 1e-4, rng)
    expect(events).toEqual([expect.objectContaining({ type: 'exit', cowId: cow.id })])
  })

  it('selects another eligible inside cow when a lot id is forced', () => {
    const rng = mulberry32(81)
    const simulation = createHerdSimulation(mockFarmPlan, rng, { randomEscapes: false })
    const lotId = simulation.lots[0].id
    const firstCow = simulation.cows.find(cow => cow.lotId === lotId)!

    expect(forceEscape(simulation, firstCow.id, rng)).toBe(true)
    expect(forceEscape(simulation, lotId, rng)).toBe(true)

    const requested = simulation.cows.filter(cow => cow.lotId === lotId && cow.escapeRequested)
    expect(requested).toHaveLength(2)
    expect(requested.some(cow => cow.id !== firstCow.id)).toBe(true)
    expect(forceEscape(simulation, 'missing-id', rng)).toBe(false)
  })
})

describe('herd containment', () => {
  it('keeps normal cows inside for thousands of steps with random escapes disabled', () => {
    const rng = mulberry32(734092)
    const simulation = createHerdSimulation(mockFarmPlan, rng, { randomEscapes: false })

    for (let index = 0; index < 4_000; index += 1) {
      const events = step(simulation, 1 / 30, rng)
      if (events.length > 0) {
        throw new Error(`Unexpected herd event at step ${index}`)
      }

      for (const cow of simulation.cows) {
        const lot = simulation.lots.find(item => item.id === cow.lotId)!
        if (!pointInPolygon(cow.position, lot.boundary)) {
          throw new Error(`${cow.name} left ${lot.name} at step ${index}`)
        }
      }
    }

    expect(step(simulation, 1_000, rng)).toEqual([])
    for (const cow of simulation.cows) {
      const lot = simulation.lots.find(item => item.id === cow.lotId)!
      expect(pointInPolygon(cow.position, lot.boundary)).toBe(true)
    }
    expect(getZoneSummaries(simulation).every(summary => !summary.breached)).toBe(true)
  })

  it('derives breaches from geometry rather than the escaped flag', () => {
    const simulation = createHerdSimulation(mockFarmPlan, mulberry32(12), { randomEscapes: false })
    const cow = simulation.cows[0]
    cow.position = { x: 500, z: 500 }
    cow.escaped = false

    expect(getZoneSummaries(simulation).find(summary => summary.lotId === cow.lotId)).toMatchObject({
      inside: 5,
      outside: 1,
      breached: true,
    })
  })
})

describe('track people', () => {
  it('advances along the track and turns around at its ends', () => {
    const plan: FarmPlan = {
      width: 100,
      height: 100,
      lots: [],
      cameras: [],
      track: [{ x: 0, y: 50 }, { x: 100, y: 50 }],
      contours: [],
    }
    const rng = mulberry32(561)
    const simulation = createHerdSimulation(plan, rng, { randomEscapes: false })
    const initialDirections = simulation.people.map(person => person.direction)
    const initialPositions = simulation.people.map(person => ({ ...person.position }))

    step(simulation, 0.5, rng)
    expect(simulation.people.some((person, index) => person.position.x !== initialPositions[index].x)).toBe(true)

    let turned = false
    for (let index = 0; index < 200; index += 1) {
      step(simulation, 0.1, rng)
      simulation.people.forEach((person, personIndex) => {
        expect(person.position.x).toBeGreaterThanOrEqual(-5)
        expect(person.position.x).toBeLessThanOrEqual(5)
        expect(person.position.z).toBeCloseTo(0)
        expect(person.distance).toBeGreaterThanOrEqual(0)
        expect(person.distance).toBeLessThanOrEqual(10)
        if (person.direction !== initialDirections[personIndex]) turned = true
      })
    }

    // Checked during the walk: after a full round trip a person can face its start direction again.
    expect(turned).toBe(true)
  })
})
