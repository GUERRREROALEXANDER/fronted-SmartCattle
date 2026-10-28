import { closestPointOnSegment, type WorldPoint } from '../../simulation/geometry'

export function distanceToPolyline(point: WorldPoint, polyline: readonly WorldPoint[]) {
  let best = Number.POSITIVE_INFINITY
  for (let index = 0; index < polyline.length - 1; index += 1) {
    const closest = closestPointOnSegment(point, polyline[index], polyline[index + 1])
    best = Math.min(best, Math.hypot(point.x - closest.x, point.z - closest.z))
  }
  return best
}

/** Resamples a polyline every `step` metres, keeping its corners. */
export function resample(points: readonly WorldPoint[], step: number) {
  const out: WorldPoint[] = []
  for (let index = 0; index < points.length - 1; index += 1) {
    const a = points[index]
    const b = points[index + 1]
    const length = Math.hypot(b.x - a.x, b.z - a.z)
    const count = Math.max(1, Math.ceil(length / step))
    for (let k = 0; k < count; k += 1) {
      const t = k / count
      out.push({ x: a.x + (b.x - a.x) * t, z: a.z + (b.z - a.z) * t })
    }
  }
  if (points.length > 0) out.push(points[points.length - 1])
  return out
}

/** Track extended past the farm edges, so the road visibly leads in and out. */
export function extendTrack(track: readonly WorldPoint[], reach = 140) {
  if (track.length < 2) return [...track]
  const extend = (from: WorldPoint, toward: WorldPoint) => {
    const dx = from.x - toward.x
    const dz = from.z - toward.z
    const length = Math.hypot(dx, dz) || 1
    return { x: from.x + (dx / length) * reach, z: from.z + (dz / length) * reach }
  }
  return [extend(track[0], track[1]), ...track, extend(track[track.length - 1], track[track.length - 2])]
}
