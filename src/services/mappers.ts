import type { ApiAlert, ApiCamera, ApiEvent, ApiEventLevel, ApiLiveMetrics, ApiLiveStatus, ApiLot, ApiStreamDetection } from '../types/api'
import type {
  Alert, Camera, EventKind, FarmEvent, FrameDetections, LiveMetrics, Lot, NormalizedBounds, NormalizedBox, NormalizedPoint,
  SafeZone, Severity,
} from '../types/domain'
import { eventCatalog } from '../lib/eventCatalog'

/** The backend only knows camera ids; "camera-01" reads as "Cámara 01". */
export function toCamera(camera: ApiCamera): Camera {
  const number = /^camera-(\d+)$/.exec(camera.id)?.[1]
  return {
    id: camera.id, name: number ? `Cámara ${number}` : camera.id, location: 'Cámara IP',
    status: camera.status, lastSeenAt: camera.last_online_at ? new Date(camera.last_online_at) : null,
    lastError: camera.last_error, streamUrl: camera.stream_url,
  }
}

/** Pixel boxes from the AI service become normalized detections; null until a frame exists. */
export function toFrameDetections(live: ApiLiveStatus): FrameDetections | null {
  const { width, height } = live
  if (!width || !height || !live.captured_at) return null
  return {
    cameraId: live.camera_id, capturedAt: new Date(live.captured_at),
    detections: live.detections.map((item, index) => {
      const [x1, y1, x2, y2] = item.bbox
      return {
        id: `${live.camera_id}-${index}`, label: item.class, confidence: item.confidence, insideSafeZone: item.inside_zone,
        box: { x: x1 / width, y: y1 / height, width: (x2 - x1) / width, height: (y2 - y1) / height },
      }
    }),
  }
}

/**
 * The backend's severity, in the vocabulary the interface uses.
 *
 * The backend derives low/medium/high from the detection confidence, which is
 * information the catalog cannot have: the catalog knows only the event type,
 * and with one type every alert looked equally urgent whether the detector was
 * 51 % or 99 % sure.
 */
export const levelSeverity: Record<ApiEventLevel, Severity> = { low: 'info', medium: 'warning', high: 'critical' }

export function toFarmEvent(event: ApiEvent): FarmEvent {
  // severitySource records where the ranking came from, so the interface can
  // say whether it is showing a judgement from the server or a default from
  // the catalog. It has had a 'backend' option since before anything could
  // produce one.
  const fromBackend = levelSeverity[event.level] as Severity | undefined
  return {
    id: event.id, kind: event.event_type, cameraId: event.camera_id,
    detectedObject: event.detected_object, confidence: event.confidence,
    occurredAt: new Date(event.timestamp), receivedAt: new Date(event.received_at),
    severity: fromBackend ?? eventCatalog[event.event_type].defaultSeverity,
    severitySource: fromBackend ? 'backend' : 'catalog',
  }
}

export function toAlert(alert: ApiAlert): Alert {
  const kind = Object.hasOwn(eventCatalog, alert.alert_type) ? alert.alert_type as EventKind : null
  return {
    id: alert.id, eventId: alert.event_id, cameraId: alert.camera_id, kind, message: alert.message,
    severity: levelSeverity[alert.severity], status: alert.status, createdAt: new Date(alert.created_at),
    acknowledgedAt: alert.acknowledged_at ? new Date(alert.acknowledged_at) : null,
    resolvedAt: alert.resolved_at ? new Date(alert.resolved_at) : null,
  }
}

export function toLiveMetrics(metrics: ApiLiveMetrics): LiveMetrics {
  return {
    camerasTotal: metrics.cameras_total, camerasOnline: metrics.cameras_online, staleCameras: metrics.stale_cameras,
    cattleInside: metrics.cattle_inside, cattleOutside: metrics.cattle_outside, cattleTotal: metrics.cattle_total,
    openAlerts: metrics.open_alerts, eventsLastHour: metrics.events_last_hour, systemStatus: metrics.system_status,
    generatedAt: new Date(metrics.generated_at),
  }
}

export function toLot(lot: ApiLot): Lot {
  const area = lot.area_square_meters ?? (lot.length_meters && lot.width_meters ? lot.length_meters * lot.width_meters : null)
  return {
    id: `lot-${lot.id}`, name: lot.name, kind: lot.kind, areaSquareMeters: area, capacity: lot.capacity,
    cameraId: lot.camera_id, active: lot.active,
  }
}

/** A detection pushed on /ws/live; boxes are already normalised [x1, y1, x2, y2]. */
export function toStreamFrame(cameraId: string, observedAt: string, detections: readonly ApiStreamDetection[]): FrameDetections {
  return {
    cameraId, capturedAt: new Date(observedAt),
    detections: detections.map((item, index) => {
      const [x1, y1, x2, y2] = item.bbox
      return {
        id: item.track_id === null ? `${cameraId}-${index}` : `${cameraId}#${item.track_id}`,
        trackId: item.track_id, label: item.label, confidence: item.confidence, insideSafeZone: item.inside_zone,
        box: { x: Math.min(x1, x2), y: Math.min(y1, y2), width: Math.abs(x2 - x1), height: Math.abs(y2 - y1) },
      }
    }),
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
