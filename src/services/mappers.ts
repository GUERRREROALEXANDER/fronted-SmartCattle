import type { ApiEvent } from '../types/api'
import type { FarmEvent, NormalizedBounds, NormalizedBox } from '../types/domain'
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
