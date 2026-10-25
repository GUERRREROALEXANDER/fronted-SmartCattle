import { describe, expect, it } from 'vitest'
import {
  closestPointOnPolygon,
  planToWorld,
  pointAlongPolyline,
  pointInPolygon,
  polygonCentroid,
  polylineLength,
  polylineTangent,
  randomPointInPolygon,
  type WorldPoint,
} from './geometry'
import { mulberry32 } from './rng'

const square: readonly WorldPoint[] = [
  { x: 0, z: 0 },
  { x: 4, z: 0 },
  { x: 4, z: 4 },
  { x: 0, z: 4 },
]

const concavePolygon: readonly WorldPoint[] = [
  { x: 0, z: 0 },
  { x: 4, z: 0 },
  { x: 4, z: 4 },
  { x: 2, z: 2 },
  { x: 0, z: 4 },
]

describe('geometry', () => {
  it('maps centered plan coordinates to world x and z', () => {
    expect(planToWorld({ x: 400, y: 260 }, 800, 520)).toEqual({ x: 0, z: 0 })
    expect(planToWorld({ x: 0, y: 0 }, 800, 520)).toEqual({ x: -40, z: -26 })
    expect(planToWorld({ x: 800, y: 520 }, 800, 520)).toEqual({ x: 40, z: 26 })
    expect(planToWorld({ x: 50, y: 25 }, 100, 50, 0.2)).toEqual({ x: 0, z: 0 })
  })

  it('classifies inside, outside, boundary, and concave polygon points', () => {
    expect(pointInPolygon({ x: 2, z: 2 }, square)).toBe(true)
    expect(pointInPolygon({ x: 4, z: 2 }, square)).toBe(true)
    expect(pointInPolygon({ x: 5, z: 2 }, square)).toBe(false)
    expect(pointInPolygon({ x: 1, z: 3 }, concavePolygon)).toBe(true)
    expect(pointInPolygon({ x: 2, z: 3.5 }, concavePolygon)).toBe(false)
  })

  it('computes area centroids and closest boundary points', () => {
    expect(polygonCentroid(square)).toEqual({ x: 2, z: 2 })
    expect(polygonCentroid([...square].reverse())).toEqual({ x: 2, z: 2 })
    expect(closestPointOnPolygon({ x: 6, z: 2 }, square)).toEqual({ x: 4, z: 2 })
    expect(closestPointOnPolygon({ x: 2, z: -3 }, square)).toEqual({ x: 2, z: 0 })
  })

  it('samples deterministic points that all belong to the polygon', () => {
    const firstRng = mulberry32(9274)
    const secondRng = mulberry32(9274)
    const firstSamples = Array.from({ length: 200 }, () => randomPointInPolygon(concavePolygon, firstRng))
    const secondSamples = Array.from({ length: 200 }, () => randomPointInPolygon(concavePolygon, secondRng))

    expect(firstSamples).toEqual(secondSamples)
    for (const point of firstSamples) {
      expect(pointInPolygon(point, concavePolygon)).toBe(true)
    }
  })

  it('uses a safe deterministic fallback when sampling cannot find a point', () => {
    const values = [0.5, 0.9]
    let call = 0
    const point = randomPointInPolygon(concavePolygon, () => values[call++ % values.length])

    expect(call).toBe(512)
    expect(pointInPolygon(point, concavePolygon)).toBe(true)
  })

  it('samples and orients points along a clamped polyline', () => {
    const line: readonly WorldPoint[] = [{ x: 0, z: 0 }, { x: 3, z: 0 }, { x: 3, z: 4 }]

    expect(polylineLength(line)).toBe(7)
    expect(pointAlongPolyline(line, 5)).toEqual({ x: 3, z: 2 })
    expect(pointAlongPolyline(line, -1)).toEqual({ x: 0, z: 0 })
    expect(pointAlongPolyline(line, 20)).toEqual({ x: 3, z: 4 })
    expect(polylineTangent(line, 5)).toEqual({ x: 0, z: 1 })
  })
})

describe('mulberry32', () => {
  it('repeats the same sequence for the same seed', () => {
    const first = mulberry32(42)
    const second = mulberry32(42)
    const sequence = Array.from({ length: 20 }, () => first())

    expect(Array.from({ length: 20 }, () => second())).toEqual(sequence)
    expect(sequence.every(value => value >= 0 && value < 1)).toBe(true)
  })
})
