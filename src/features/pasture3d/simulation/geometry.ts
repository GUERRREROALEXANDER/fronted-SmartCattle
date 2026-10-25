import type { Rng } from './rng'

export interface WorldPoint {
  x: number
  z: number
}

interface PlanPointLike {
  x: number
  y: number
}

const EPSILON = 1e-9
const RANDOM_POINT_ATTEMPTS = 256

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

function distanceSquared(a: WorldPoint, b: WorldPoint): number {
  const dx = a.x - b.x
  const dz = a.z - b.z
  return dx * dx + dz * dz
}

export function planToWorld(
  point: PlanPointLike,
  planWidth: number,
  planHeight: number,
  scale = 0.1,
): WorldPoint {
  return {
    x: (point.x - planWidth / 2) * scale,
    z: (point.y - planHeight / 2) * scale,
  }
}

export function closestPointOnSegment(point: WorldPoint, start: WorldPoint, end: WorldPoint): WorldPoint {
  const dx = end.x - start.x
  const dz = end.z - start.z
  const lengthSquared = dx * dx + dz * dz

  if (lengthSquared <= EPSILON) {
    return { x: start.x, z: start.z }
  }

  const projection = ((point.x - start.x) * dx + (point.z - start.z) * dz) / lengthSquared
  const t = clamp(projection, 0, 1)
  return { x: start.x + dx * t, z: start.z + dz * t }
}

export function closestPointOnPolygon(point: WorldPoint, polygon: readonly WorldPoint[]): WorldPoint {
  if (polygon.length === 0) {
    return { x: 0, z: 0 }
  }

  let closest = { x: polygon[0].x, z: polygon[0].z }
  let closestDistance = distanceSquared(point, closest)

  for (let index = 0; index < polygon.length; index += 1) {
    const candidate = closestPointOnSegment(point, polygon[index], polygon[(index + 1) % polygon.length])
    const candidateDistance = distanceSquared(point, candidate)
    if (candidateDistance < closestDistance) {
      closest = candidate
      closestDistance = candidateDistance
    }
  }

  return closest
}

export function distanceToPolygonBoundary(point: WorldPoint, polygon: readonly WorldPoint[]): number {
  if (polygon.length === 0) {
    return Number.POSITIVE_INFINITY
  }

  return Math.sqrt(distanceSquared(point, closestPointOnPolygon(point, polygon)))
}

/** Points on the boundary are considered inside. */
export function pointInPolygon(point: WorldPoint, polygon: readonly WorldPoint[]): boolean {
  if (polygon.length < 3) {
    return false
  }

  let inside = false

  for (let index = 0; index < polygon.length; index += 1) {
    const start = polygon[index]
    const end = polygon[(index + 1) % polygon.length]
    const closest = closestPointOnSegment(point, start, end)

    if (distanceSquared(point, closest) <= EPSILON * EPSILON) {
      return true
    }

    const crossesHorizontalRay = (start.z > point.z) !== (end.z > point.z)
    if (crossesHorizontalRay) {
      const intersectionX = start.x + ((point.z - start.z) * (end.x - start.x)) / (end.z - start.z)
      if (point.x < intersectionX) {
        inside = !inside
      }
    }
  }

  return inside
}

export function polygonCentroid(polygon: readonly WorldPoint[]): WorldPoint {
  if (polygon.length === 0) {
    return { x: 0, z: 0 }
  }

  let crossSum = 0
  let weightedX = 0
  let weightedZ = 0
  let averageX = 0
  let averageZ = 0

  for (let index = 0; index < polygon.length; index += 1) {
    const current = polygon[index]
    const next = polygon[(index + 1) % polygon.length]
    const cross = current.x * next.z - next.x * current.z
    crossSum += cross
    weightedX += (current.x + next.x) * cross
    weightedZ += (current.z + next.z) * cross
    averageX += current.x
    averageZ += current.z
  }

  if (Math.abs(crossSum) <= EPSILON) {
    return { x: averageX / polygon.length, z: averageZ / polygon.length }
  }

  return {
    x: weightedX / (3 * crossSum),
    z: weightedZ / (3 * crossSum),
  }
}

function scanlineInteriorPoint(polygon: readonly WorldPoint[]): WorldPoint | null {
  const levels = [...new Set(polygon.map(point => point.z))].sort((a, b) => a - b)
  const scanlines: number[] = []

  for (let index = 0; index < levels.length - 1; index += 1) {
    if (levels[index + 1] - levels[index] > EPSILON) {
      scanlines.push((levels[index] + levels[index + 1]) / 2)
    }
  }

  let bestPoint: WorldPoint | null = null
  let bestClearance = 0

  for (const z of scanlines) {
    const intersections: number[] = []

    for (let index = 0; index < polygon.length; index += 1) {
      const start = polygon[index]
      const end = polygon[(index + 1) % polygon.length]
      if ((start.z > z) !== (end.z > z)) {
        intersections.push(start.x + ((z - start.z) * (end.x - start.x)) / (end.z - start.z))
      }
    }

    intersections.sort((a, b) => a - b)

    for (let index = 0; index + 1 < intersections.length; index += 2) {
      const left = intersections[index]
      const right = intersections[index + 1]
      if (right - left <= EPSILON) {
        continue
      }

      const candidate = { x: (left + right) / 2, z }
      if (!pointInPolygon(candidate, polygon)) {
        continue
      }

      const clearance = distanceToPolygonBoundary(candidate, polygon)
      if (clearance > bestClearance) {
        bestPoint = candidate
        bestClearance = clearance
      }
    }
  }

  return bestPoint
}

/** Returns a deterministic interior fallback, including for concave polygons. */
export function polygonInteriorPoint(polygon: readonly WorldPoint[]): WorldPoint {
  if (polygon.length === 0) {
    return { x: 0, z: 0 }
  }

  const centroid = polygonCentroid(polygon)
  if (pointInPolygon(centroid, polygon) && distanceToPolygonBoundary(centroid, polygon) > EPSILON) {
    return centroid
  }

  const scanlinePoint = polygon.length >= 3 ? scanlineInteriorPoint(polygon) : null
  if (scanlinePoint) {
    return scanlinePoint
  }

  return { x: polygon[0].x, z: polygon[0].z }
}

/**
 * Rejection sampling gives repeatable, evenly distributed points. The bounded
 * fallback also handles degenerate polygons and poorly behaved custom RNGs.
 */
export function randomPointInPolygon(polygon: readonly WorldPoint[], rng: Rng): WorldPoint {
  if (polygon.length < 3) {
    return polygonCentroid(polygon)
  }

  let minX = Number.POSITIVE_INFINITY
  let maxX = Number.NEGATIVE_INFINITY
  let minZ = Number.POSITIVE_INFINITY
  let maxZ = Number.NEGATIVE_INFINITY

  for (const point of polygon) {
    minX = Math.min(minX, point.x)
    maxX = Math.max(maxX, point.x)
    minZ = Math.min(minZ, point.z)
    maxZ = Math.max(maxZ, point.z)
  }

  const width = maxX - minX
  const height = maxZ - minZ

  for (let attempt = 0; attempt < RANDOM_POINT_ATTEMPTS; attempt += 1) {
    const candidate = {
      x: minX + rng() * width,
      z: minZ + rng() * height,
    }
    if (pointInPolygon(candidate, polygon)) {
      return candidate
    }
  }

  return polygonInteriorPoint(polygon)
}

export function polylineLength(polyline: readonly WorldPoint[]): number {
  let length = 0
  for (let index = 0; index < polyline.length - 1; index += 1) {
    length += Math.sqrt(distanceSquared(polyline[index], polyline[index + 1]))
  }
  return length
}

export function pointAlongPolyline(polyline: readonly WorldPoint[], distance: number): WorldPoint {
  if (polyline.length === 0) {
    return { x: 0, z: 0 }
  }
  if (polyline.length === 1 || distance <= 0) {
    return { x: polyline[0].x, z: polyline[0].z }
  }

  let remaining = distance

  for (let index = 0; index < polyline.length - 1; index += 1) {
    const start = polyline[index]
    const end = polyline[index + 1]
    const segmentLength = Math.sqrt(distanceSquared(start, end))

    if (segmentLength > EPSILON) {
      if (remaining <= segmentLength) {
        const t = remaining / segmentLength
        return {
          x: start.x + (end.x - start.x) * t,
          z: start.z + (end.z - start.z) * t,
        }
      }
      remaining -= segmentLength
    }
  }

  const last = polyline[polyline.length - 1]
  return { x: last.x, z: last.z }
}

export function polylineTangent(polyline: readonly WorldPoint[], distance: number): WorldPoint {
  if (polyline.length < 2) {
    return { x: 1, z: 0 }
  }

  let remaining = Math.max(0, distance)
  let fallback = { x: 1, z: 0 }

  for (let index = 0; index < polyline.length - 1; index += 1) {
    const start = polyline[index]
    const end = polyline[index + 1]
    const dx = end.x - start.x
    const dz = end.z - start.z
    const segmentLength = Math.sqrt(dx * dx + dz * dz)

    if (segmentLength <= EPSILON) {
      continue
    }

    fallback = { x: dx / segmentLength, z: dz / segmentLength }
    if (remaining <= segmentLength) {
      return fallback
    }
    remaining -= segmentLength
  }

  return fallback
}
