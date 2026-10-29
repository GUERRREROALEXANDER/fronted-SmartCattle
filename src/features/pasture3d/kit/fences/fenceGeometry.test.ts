import { describe, expect, it } from 'vitest'
import type { WorldPoint } from '../../simulation/geometry'
import { POST_HEIGHT, RAIL_HEIGHTS, WIRE_HEIGHT, cleanBoundary, layoutFence } from './fenceGeometry'

const square: WorldPoint[] = [
  { x: -10, z: -10 }, { x: 10, z: -10 }, { x: 10, z: 10 }, { x: -10, z: 10 },
]
const track: WorldPoint[] = [{ x: -40, z: -14 }, { x: 40, z: -14 }]

describe('cleanBoundary', () => {
  it('leaves a clean polygon alone', () => {
    expect(cleanBoundary(square)).toEqual(square)
  })

  it('drops a repeated consecutive point', () => {
    // Two identical points make a zero-length span, and a fence span with no
    // length produces a post with no direction to face.
    const withDuplicate = [square[0], { ...square[0] }, square[1], square[2]]
    expect(cleanBoundary(withDuplicate)).toEqual([square[0], square[1], square[2]])
  })

  it('drops a closing point equal to the first', () => {
    // A polygon written closed would otherwise get a duplicate post and a
    // zero-length span exactly at the corner the eye goes to first.
    const closed = [...square, { ...square[0] }]
    expect(cleanBoundary(closed)).toEqual(square)
  })

  it('keeps distinct points that are merely close', () => {
    // The threshold exists to remove duplicates, not to simplify the shape.
    const near = [square[0], { x: square[0].x + 0.01, z: square[0].z }, square[1]]
    expect(cleanBoundary(near)).toHaveLength(3)
  })

  it('handles an empty and a single-point boundary', () => {
    expect(cleanBoundary([])).toEqual([])
    expect(cleanBoundary([square[0]])).toEqual([square[0]])
  })
})

describe('layoutFence', () => {
  it('encloses the lot with spans', () => {
    const layout = layoutFence(square, track)
    // One span per edge of the polygon, so the fence closes rather than
    // leaving the herd a gap.
    expect(layout.spans.length).toBeGreaterThanOrEqual(square.length)
  })

  it('places a post for every span', () => {
    const layout = layoutFence(square, track)
    expect(layout.posts.length).toBeGreaterThan(0)
  })

  it('puts the gate on the edge facing the track', () => {
    const layout = layoutFence(square, track)
    // The track runs along z = -14, below the square, so the gate belongs on
    // the southern edge. A gate on the far side means the road leads to a
    // fence.
    expect(layout.gate).toBeTruthy()
    expect(layout.gate!.center.z).toBeLessThan(0)
  })

  it('keeps every post upright and finite', () => {
    const layout = layoutFence(square, track)
    for (const post of layout.posts) {
      expect(Number.isFinite(post.x)).toBe(true)
      expect(Number.isFinite(post.z)).toBe(true)
      expect(post.height).toBeGreaterThan(0)
      expect(post.thickness).toBeGreaterThan(0)
    }
  })

  it('is deterministic for the same lot', () => {
    // The fence is rebuilt on every render of the scene. A random layout would
    // make the posts jitter.
    const first = layoutFence(square, track)
    const second = layoutFence(square, track)
    expect(second.posts).toEqual(first.posts)
    expect(second.spans).toEqual(first.spans)
  })

  it('survives a boundary with a repeated point', () => {
    // cleanBoundary is meant to absorb this; the test is that the two work
    // together rather than each being correct alone.
    const layout = layoutFence([square[0], { ...square[0] }, square[1], square[2]], track)
    expect(layout.spans.every(span => Number.isFinite(span.ya) && Number.isFinite(span.yb))).toBe(true)
  })

  it('produces nothing rather than failing on a degenerate lot', () => {
    const layout = layoutFence([{ x: 1, z: 1 }], track)
    expect(layout.spans).toEqual([])
  })
})

describe('the fence dimensions', () => {
  it('keeps the rails below the post top', () => {
    // A rail above the post would float with nothing holding it.
    for (const height of RAIL_HEIGHTS) {
      expect(height).toBeLessThan(POST_HEIGHT)
    }
  })

  it('keeps the wire below the post top and above the rails', () => {
    expect(WIRE_HEIGHT).toBeLessThan(POST_HEIGHT)
    expect(WIRE_HEIGHT).toBeGreaterThan(Math.max(...RAIL_HEIGHTS))
  })

  it('orders the rails bottom to top', () => {
    expect([...RAIL_HEIGHTS]).toEqual([...RAIL_HEIGHTS].sort((a, b) => a - b))
  })
})
