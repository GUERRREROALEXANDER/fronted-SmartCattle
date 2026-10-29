import { describe, expect, it } from 'vitest'
import type { WorldPoint } from '../../simulation/geometry'
import { distanceToPolyline, extendTrack, resample } from './paths'

const line: WorldPoint[] = [{ x: 0, z: 0 }, { x: 10, z: 0 }]

describe('distanceToPolyline', () => {
  it('is zero on the line', () => {
    expect(distanceToPolyline({ x: 5, z: 0 }, line)).toBeCloseTo(0)
  })

  it('measures perpendicular distance', () => {
    expect(distanceToPolyline({ x: 5, z: 3 }, line)).toBeCloseTo(3)
  })

  it('measures to the endpoint past the end', () => {
    // Not to the infinite line. A point beyond the track is as far as the
    // track's end, which is what keeps the road from appearing to continue.
    expect(distanceToPolyline({ x: 14, z: 0 }, line)).toBeCloseTo(4)
  })

  it('takes the nearest segment of a bend', () => {
    const bend: WorldPoint[] = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }]
    expect(distanceToPolyline({ x: 12, z: 5 }, bend)).toBeCloseTo(2)
  })

  it('is infinite for a polyline with no segments', () => {
    // A single point has no segment to measure against, and returning 0 would
    // place every point on the road.
    expect(distanceToPolyline({ x: 1, z: 1 }, [{ x: 0, z: 0 }])).toBe(Number.POSITIVE_INFINITY)
  })
})

describe('resample', () => {
  it('keeps the endpoints', () => {
    const out = resample(line, 2.5)
    expect(out[0]).toEqual({ x: 0, z: 0 })
    expect(out[out.length - 1]).toEqual({ x: 10, z: 0 })
  })

  it('spaces points no further apart than the step', () => {
    const out = resample(line, 2.5)
    for (let index = 1; index < out.length; index += 1) {
      const gap = Math.hypot(out[index].x - out[index - 1].x, out[index].z - out[index - 1].z)
      expect(gap).toBeLessThanOrEqual(2.5 + 1e-9)
    }
  })

  it('keeps a corner', () => {
    // The whole point of resampling rather than regenerating: the road's
    // corners are where it was drawn to turn.
    const corner: WorldPoint[] = [{ x: 0, z: 0 }, { x: 10, z: 0 }, { x: 10, z: 10 }]
    const out = resample(corner, 3)
    expect(out.some(point => point.x === 10 && point.z === 0)).toBe(true)
  })

  it('emits at least the two ends for a segment shorter than the step', () => {
    const out = resample([{ x: 0, z: 0 }, { x: 1, z: 0 }], 10)
    expect(out).toEqual([{ x: 0, z: 0 }, { x: 1, z: 0 }])
  })

  it('returns an empty list for no points', () => {
    expect(resample([], 5)).toEqual([])
  })
})

describe('extendTrack', () => {
  it('adds a point beyond each end, along the track direction', () => {
    const out = extendTrack(line, 10)
    expect(out[0]).toEqual({ x: -10, z: 0 })
    expect(out[out.length - 1]).toEqual({ x: 20, z: 0 })
  })

  it('keeps the original points in between', () => {
    expect(extendTrack(line, 10).slice(1, -1)).toEqual(line)
  })

  it('leaves a track too short to have a direction alone', () => {
    // One point has no direction to extend along, and guessing one would send
    // the road off at an arbitrary angle.
    expect(extendTrack([{ x: 1, z: 2 }], 10)).toEqual([{ x: 1, z: 2 }])
    expect(extendTrack([], 10)).toEqual([])
  })

  it('does not divide by zero on a repeated point', () => {
    // Two identical points give a zero-length direction; the fallback keeps
    // the result finite rather than producing NaN coordinates that make the
    // mesh vanish.
    const out = extendTrack([{ x: 3, z: 3 }, { x: 3, z: 3 }], 10)
    expect(out.every(point => Number.isFinite(point.x) && Number.isFinite(point.z))).toBe(true)
  })
})
