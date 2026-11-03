import { describe, expect, it } from 'vitest'
import { buildFarmPlan } from '../services/farmLayout'
import type { FrameDetections, Lot } from '../types/domain'
import { createHerdMotion, stepHerd, syncHerd } from './herdMotion'
import { zoneSummaries } from './herdSummary'
import { entityKind, lotPoint, pictureToLot, trackEntities } from './herdTracker'

const lots: Lot[] = [
  { id: 'lot-1', name: 'Norte', kind: 'pasture', areaSquareMeters: 9000, capacity: 30, cameraId: 'camera-01', active: true },
  { id: 'lot-2', name: 'Sur', kind: 'pasture', areaSquareMeters: 4000, capacity: 30, cameraId: null, active: true },
]
const plan = buildFarmPlan(lots, [{ id: 'camera-01' }])!
const at = new Date('2026-10-31T15:00:00Z')
const frame = (detections: FrameDetections['detections']): Record<string, FrameDetections> => ({ 'camera-01': { cameraId: 'camera-01', capturedAt: at, detections } })
const box = (x: number, y: number) => ({ x: x - 0.04, y: y - 0.07, width: 0.08, height: 0.07 })

function inside(point: { x: number; y: number }, polygon: readonly { x: number; y: number }[]) {
  let result = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [a, b] = [polygon[i], polygon[j]]
    if ((a.y > point.y) !== (b.y > point.y) && point.x < ((b.x - a.x) * (point.y - a.y)) / (b.y - a.y) + a.x) result = !result
  }
  return result
}

describe('trackEntities', () => {
  const lot = plan.lots.find(item => item.id === 'lot-1')!

  it('places a box inside the safe zone inside its lot, and one outside past the lindero', () => {
    const entities = trackEntities({ plan, occupancy: {}, frames: frame([
      { id: 'a', trackId: 1, label: 'cow', confidence: 0.9, box: box(0.5, 0.6), insideSafeZone: true },
      { id: 'b', trackId: 2, label: 'cow', confidence: 0.9, box: box(0.5, 0.6), insideSafeZone: false },
    ]) })
    expect(entities.map(entity => entity.id)).toEqual(['camera-01#1', 'camera-01#2'])
    expect(inside(entities[0].target, lot.boundary)).toBe(true)
    expect(entities[1].outside).toBe(true)
    expect(inside(entities[1].target, lot.boundary)).toBe(false)
  })
  it('draws a head count when the camera sends no boxes, outside ones past the fence', () => {
    const entities = trackEntities({ plan, frames: {}, occupancy: { 'camera-01': { cameraId: 'camera-01', inside: 3, outside: 1, observedAt: at } } })
    expect(entities).toHaveLength(4)
    expect(entities.filter(entity => entity.outside)).toHaveLength(1)
    expect(entities.every(entity => entity.source === 'count')).toBe(true)
    expect(entities.filter(entity => !entity.outside).every(entity => inside(entity.target, lot.boundary))).toBe(true)
  })
  it('summarises per lot and marks a lot without camera as unwatched', () => {
    const entities = trackEntities({ plan, occupancy: {}, frames: frame([
      { id: 'a', trackId: 1, label: 'cow', confidence: 0.9, box: box(0.5, 0.6), insideSafeZone: false },
      { id: 'p', trackId: 9, label: 'person', confidence: 0.8, box: box(0.3, 0.5), insideSafeZone: true },
    ]) })
    expect(zoneSummaries(plan, entities)).toEqual([
      expect.objectContaining({ lotId: 'lot-1', total: 1, outside: 1, people: 1, breached: true, watched: true }),
      expect.objectContaining({ lotId: 'lot-2', total: 0, watched: false }),
    ])
  })
  it('knows cows, people and anything else apart', () => {
    expect([entityKind('cow'), entityKind('Person'), entityKind('dog')]).toEqual(['cow', 'person', 'other'])
  })
})

describe('pictureToLot', () => {
  it('follows the AI verdict over the geometry', () => {
    const bounds = [0.1, 0.1, 0.9, 0.9] as const
    const out = pictureToLot(0.5, 0.5, bounds, false)
    expect(out.s < 0 || out.s > 1 || out.t < 0 || out.t > 1).toBe(true)
    const kept = pictureToLot(0.02, 0.5, bounds, true)
    expect(kept.s).toBeGreaterThanOrEqual(0)
  })
  it('maps the unit square onto the lot corners', () => {
    const lot = { boundary: [{ x: 0, y: 0 }, { x: 10, y: 0 }, { x: 10, y: 10 }, { x: 0, y: 10 }] }
    expect(lotPoint(lot, 0.5, 0.5)).toEqual({ x: 5, y: 5 })
  })
})

describe('herd motion', () => {
  const config = { toSpace: (point: { x: number; y: number }) => ({ x: point.x, z: point.y }), cowSpeed: 10, personSpeed: 10, arriveRadius: 0.5 }
  const entity = (x: number) => ({
    id: 'c#1', kind: 'cow' as const, label: 'cow', cameraId: 'c', lotId: 'l', target: { x, y: 0 }, outside: false,
    confidence: 0.9, source: 'box' as const, trackId: 1, posture: null,
  })

  it('places the first herd at once, then walks to new targets instead of teleporting', () => {
    const motion = createHerdMotion(config)
    syncHerd(motion, [entity(0)])
    const agent = motion.agents.get('c#1')!
    expect(agent.presence).toBe(1)
    syncHerd(motion, [entity(100)])
    stepHerd(motion, 0.1)
    expect(agent.position.x).toBeGreaterThan(0)
    expect(agent.position.x).toBeLessThan(100)
    expect(agent.state).toBe('walking')
  })
  it('lets a vanished agent fade out before removing it', () => {
    const motion = createHerdMotion(config)
    syncHerd(motion, [entity(0)])
    syncHerd(motion, [])
    expect(motion.agents.get('c#1')?.leaving).toBe(true)
    let removed = false
    for (let frame = 0; frame < 60 && !removed; frame++) removed = stepHerd(motion, 1 / 60)
    expect(removed).toBe(true)
    expect(motion.agents.size).toBe(0)
  })
  it('snaps to the camera position with reduced motion', () => {
    const motion = createHerdMotion(config)
    syncHerd(motion, [entity(0)])
    syncHerd(motion, [entity(50)], { instant: true })
    stepHerd(motion, 0.016, { reduceMotion: true })
    expect(motion.agents.get('c#1')!.position.x).toBe(50)
  })
})

describe('a cow reported lying', () => {
  const config = { toSpace: (point: { x: number; y: number }) => ({ x: point.x, z: point.y }), cowSpeed: 10, personSpeed: 10, arriveRadius: 0.5 }
  const lying = (x: number) => ({
    id: 'c#2', kind: 'cow' as const, label: 'Vaca #2', cameraId: 'cam', lotId: 'lot', target: { x, y: 0.5 }, outside: false,
    confidence: 0.9, source: 'box' as const, trackId: 2, posture: 'lying' as const,
  })

  it('does not walk when its box shifts a little', () => {
    const motion = createHerdMotion(config)
    syncHerd(motion, [lying(1)])
    const agent = motion.agents.get('c#2')!
    const before = { ...agent.position }
    syncHerd(motion, [lying(2)])
    for (let step = 0; step < 30; step++) stepHerd(motion, 0.1)
    expect(agent.posture).toBe('lying')
    expect(agent.state).toBe('grazing')
    expect(agent.position).toEqual(before)
  })
})