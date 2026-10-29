import {
  BoxGeometry,
  CylinderGeometry,
  LatheGeometry,
  Vector2,
} from 'three'
import { pointInPolygon, type WorldPoint } from '../../simulation/geometry'
import { hash2 } from '../noise'
import { heightAt } from '../terrain/heightfield'
import { distanceToPolyline } from '../terrain/paths'

/** Round post, 1 m tall from its base, with a chamfered top. Grain runs along V. */
export const postGeometry = new LatheGeometry(
  [
    new Vector2(0.0001, -0.12),
    new Vector2(0.085, -0.12),
    new Vector2(0.08, 0.93),
    new Vector2(0.055, 1),
    new Vector2(0.0001, 1.005),
  ],
  10,
)

/** Rail board, 1 m long along X. */
export const railGeometry = new BoxGeometry(1, 0.14, 0.035)
/** Wire strand, 1 m long along X. */
export const wireGeometry = new CylinderGeometry(0.006, 0.006, 1, 4).rotateZ(Math.PI / 2)
/** Galvanised gate tube, 1 m long along X. */
export const tubeGeometry = new CylinderGeometry(0.024, 0.024, 1, 10).rotateZ(Math.PI / 2)

export const POST_HEIGHT = 1.35
export const RAIL_HEIGHTS = [0.5, 0.98] as const
export const WIRE_HEIGHT = 1.24
const SPACING = 2.6
const GATE_WIDTH = 3.6

export interface PostSpec { x: number; y: number; z: number; height: number; thickness: number; tilt: number; spin: number }
export interface SpanSpec { a: WorldPoint; b: WorldPoint; ya: number; yb: number; outward: WorldPoint }
export interface GateSpec { center: WorldPoint; y: number; angle: number; outward: WorldPoint; width: number }

export interface FenceLayout {
  posts: PostSpec[]
  spans: SpanSpec[]
  gate: GateSpec | null
}

function post(point: WorldPoint, corner: boolean): PostSpec {
  const h = hash2(point.x * 3.1, point.z * 1.7)
  return {
    x: point.x,
    y: heightAt(point.x, point.z),
    z: point.z,
    height: (corner ? 1.55 : POST_HEIGHT) * (0.95 + h * 0.1),
    thickness: corner ? 1.45 : 0.9 + h * 0.25,
    tilt: (h - 0.5) * 0.06,
    spin: h * Math.PI * 2,
  }
}

export function cleanBoundary(points: readonly WorldPoint[]) {
  const boundary = points.filter((point, index) => {
    if (index === 0) return true
    const previous = points[index - 1]
    return Math.hypot(point.x - previous.x, point.z - previous.z) > 0.0001
  })
  if (boundary.length > 1) {
    const first = boundary[0]
    const last = boundary[boundary.length - 1]
    if (Math.hypot(first.x - last.x, first.z - last.z) < 0.0001) boundary.pop()
  }
  return boundary
}

/** Posts, rail spans and a gate on the edge that faces the farm track. */
export function layoutFence(input: readonly WorldPoint[], track: readonly WorldPoint[]): FenceLayout {
  const posts: PostSpec[] = []
  const spans: SpanSpec[] = []
  // Cleaned here rather than trusted from the caller. Two identical
  // consecutive points give a zero-length edge, and every value derived from
  // it is a division by that length: the outward normal, the post positions
  // and the span heights all become NaN. Three.js does not report a NaN in a
  // buffer geometry -- the fence simply stops being drawn -- so the failure is
  // silent and looks like a rendering problem rather than bad input.
  //
  // cleanBoundary is idempotent, so the caller that already calls it is
  // unaffected.
  const boundary = cleanBoundary(input)
  if (boundary.length < 3) return { posts, spans, gate: null }

  // Gate: the edge point closest to the track, kept clear of the corners.
  let gateEdge = -1
  let gateT = 0.5
  let best = Number.POSITIVE_INFINITY
  boundary.forEach((start, index) => {
    const end = boundary[(index + 1) % boundary.length]
    const length = Math.hypot(end.x - start.x, end.z - start.z)
    if (length < GATE_WIDTH + 5) return
    for (let t = 0.15; t <= 0.85; t += 0.05) {
      const d = distanceToPolyline({ x: start.x + (end.x - start.x) * t, z: start.z + (end.z - start.z) * t }, track)
      if (d < best) {
        best = d
        gateEdge = index
        gateT = t
      }
    }
  })

  let gate: GateSpec | null = null
  boundary.forEach((start, index) => {
    const end = boundary[(index + 1) % boundary.length]
    const dx = end.x - start.x
    const dz = end.z - start.z
    const length = Math.hypot(dx, dz)
    const mid = { x: start.x + dx / 2, z: start.z + dz / 2 }
    let outward = { x: dz / length, z: -dx / length }
    if (pointInPolygon({ x: mid.x + outward.x * 0.3, z: mid.z + outward.z * 0.3 }, boundary)) {
      outward = { x: -outward.x, z: -outward.z }
    }

    // Stations along the edge, in metres from the start.
    const stations: number[] = []
    let gateFrom = -1
    if (index === gateEdge) {
      gateFrom = gateT * length - GATE_WIDTH / 2
      const gateTo = gateFrom + GATE_WIDTH
      const before = Math.max(1, Math.round(gateFrom / SPACING))
      for (let k = 0; k < before; k += 1) stations.push((gateFrom * k) / before)
      stations.push(gateFrom)
      const after = Math.max(1, Math.round((length - gateTo) / SPACING))
      for (let k = 0; k < after; k += 1) stations.push(gateTo + ((length - gateTo) * k) / after)
      const center = { x: start.x + (dx / length) * (gateFrom + GATE_WIDTH / 2), z: start.z + (dz / length) * (gateFrom + GATE_WIDTH / 2) }
      gate = {
        center,
        y: heightAt(center.x, center.z),
        angle: Math.atan2(dz, dx),
        outward,
        width: GATE_WIDTH,
      }
    } else {
      const count = Math.max(1, Math.round(length / SPACING))
      for (let k = 0; k < count; k += 1) stations.push((length * k) / count)
    }
    stations.push(length)

    const at = (s: number) => ({ x: start.x + (dx / length) * s, z: start.z + (dz / length) * s })
    stations.slice(0, -1).forEach((s, k) => posts.push(post(at(s), k === 0)))
    for (let k = 0; k < stations.length - 1; k += 1) {
      if (index === gateEdge && Math.abs(stations[k] - gateFrom) < 0.001) continue
      const a = at(stations[k])
      const b = at(stations[k + 1])
      spans.push({ a, b, ya: heightAt(a.x, a.z), yb: heightAt(b.x, b.z), outward })
    }
  })

  return { posts, spans, gate }
}
