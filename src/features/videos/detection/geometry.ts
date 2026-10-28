import type { Box, Point } from './types'

const BOUNDARY_EPSILON = 1e-9

function isPointOnSegment(point: Point, start: Point, end: Point): boolean {
  const cross = (point.y - start.y) * (end.x - start.x)
    - (point.x - start.x) * (end.y - start.y)
  if (Math.abs(cross) > BOUNDARY_EPSILON) return false

  return point.x >= Math.min(start.x, end.x) - BOUNDARY_EPSILON
    && point.x <= Math.max(start.x, end.x) + BOUNDARY_EPSILON
    && point.y >= Math.min(start.y, end.y) - BOUNDARY_EPSILON
    && point.y <= Math.max(start.y, end.y) + BOUNDARY_EPSILON
}

export function pointInPolygon(point: Point, polygon: readonly Point[]): boolean {
  if (polygon.length < 3) return false

  let inside = false
  for (let current = 0, previous = polygon.length - 1; current < polygon.length; previous = current++) {
    const start = polygon[previous]
    const end = polygon[current]
    if (isPointOnSegment(point, start, end)) return true

    const crossesRay = (start.y > point.y) !== (end.y > point.y)
    if (!crossesRay) continue

    const intersectionX = start.x
      + ((point.y - start.y) * (end.x - start.x)) / (end.y - start.y)
    if (point.x < intersectionX) inside = !inside
  }

  return inside
}

export function isBottomCenterOutside(box: Box, zone: readonly Point[]): boolean {
  const bottomCenter = {
    x: box.x + box.w / 2,
    y: box.y + box.h,
  }
  return !pointInPolygon(bottomCenter, zone)
}
