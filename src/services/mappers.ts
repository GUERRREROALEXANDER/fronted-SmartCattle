import type { ApiEvent } from '../types/api'
import type { FarmEvent, NormalizedBounds, NormalizedBox, NormalizedPoint, SafeZone } from '../types/domain'
import { eventCatalog } from '../lib/eventCatalog'

export function toFarmEvent(event: ApiEvent): FarmEvent {
  return {
    id: event.id, kind: event.event_type, cameraId: event.camera_id,
    detectedObject: event.detected_object, confidence: event.confidence,
    occurredAt: new Date(event.timestamp), receivedAt: new Date(event.received_at),
    severity: eventCatalog[event.event_type].defaultSeverity, severitySource: 'catalog',
  }
}

export function isWithinBounds(box: NormalizedBox, bounds: NormalizedBounds): boolean {
  const x = box.x + box.width / 2
  const y = box.y + box.height
  return x >= bounds[0] && x <= bounds[2] && y >= bounds[1] && y <= bounds[3]
}

/** Ray-casting point-in-polygon test. */
export function isPointInPolygon([x, y]: NormalizedPoint, polygon: readonly NormalizedPoint[]): boolean {
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [xi, yi] = polygon[i]
    const [xj, yj] = polygon[j]
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

/** Same anchor as the prototype rule: the bottom-center of the box (where the animal stands). */
export function isInsideZone(box: NormalizedBox, zone: SafeZone): boolean {
  if (!zone.outline) return isWithinBounds(box, zone.bounds)
  return isPointInPolygon([box.x + box.width / 2, box.y + box.height], zone.outline)
}
