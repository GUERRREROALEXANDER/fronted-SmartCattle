export type DataSource = 'api' | 'mock' | 'unavailable'
// An unavailable capability carries null data; use Sourced<T | null> for these capabilities.
export interface Sourced<T> { data: T; source: DataSource }
export type Severity = 'info' | 'warning' | 'critical'
// Only cattle_out_of_zone is supported by the backend today.
export type EventKind = 'cattle_out_of_zone' | 'person_detected' | 'possible_intrusion' | 'external_animal_detected' | 'possible_unauthorized_movement' | 'camera_disconnected' | 'ai_unavailable'
export type EventCategory = 'cattle' | 'security' | 'system'
export interface FarmEvent {
  id: string
  kind: EventKind
  cameraId: string
  detectedObject: string | null
  confidence: number | null
  occurredAt: Date
  receivedAt: Date
  severity: Severity
  severitySource: 'backend' | 'catalog'
}
export type CameraStatus = 'online' | 'connecting' | 'offline' | 'error'
export interface Camera {
  id: string; name: string; location: string; status: CameraStatus; lastSeenAt: Date | null; lastError?: string | null
  /** Address of the AI service (live.py) streaming this camera, when it reported one. */
  streamUrl?: string | null
}
// Coordinates range from 0 to 1.
export type NormalizedBounds = readonly [xMin: number, yMin: number, xMax: number, yMax: number]
export type NormalizedPoint = readonly [x: number, y: number]
/** `outline` is an optional polygon; when present it defines the zone, and `bounds` is its bounding box. */
export interface SafeZone { id: string; cameraId: string; name: string; bounds: NormalizedBounds; outline?: readonly NormalizedPoint[] }
/** How a camera's picture reaches the browser. Only 'image' and 'mjpeg' are rendered today. */
export type StreamSource =
  | { kind: 'image'; url: string; width: number; height: number; synthetic: boolean }
  // `annotated`: boxes and safe zone are already drawn into the video, so the overlay must not repeat them.
  | { kind: 'mjpeg'; url: string; width: number; height: number; annotated?: boolean }
  | { kind: 'hls'; url: string }
  | { kind: 'none' }
// Coordinates range from 0 to 1, with a top-left origin.
export interface NormalizedBox { x: number; y: number; width: number; height: number }
/** `trackId` is the AI tracker's id, stable across frames of one camera; null when the source has no tracker. */
export interface Detection { id: string; trackId?: number | null; label: string; confidence: number; box: NormalizedBox; insideSafeZone: boolean | null }
export interface FrameDetections { cameraId: string; capturedAt: Date; detections: Detection[] }
export interface SystemStatus {
  // 'not-checked' means mock mode; the backend was never contacted.
  backend: 'online' | 'offline' | 'not-checked'
  aiConfigured: boolean | null
  version: string | null
  storage: string | null
  checkedAt: Date
}
export interface Farm { id: string; name: string; location?: string | null; areaHectares?: number | null }
export type UserRole = 'owner' | 'worker'

export type AlertStatus = 'open' | 'acknowledged' | 'resolved'
/** A security alert raised by a detection; people move it open → acknowledged → resolved. */
export interface Alert {
  id: string
  eventId: string | null
  cameraId: string | null
  /** Null for alert types this frontend does not know yet; `message` still describes it. */
  kind: EventKind | null
  message: string
  severity: Severity
  status: AlertStatus
  createdAt: Date
  acknowledgedAt: Date | null
  resolvedAt: Date | null
}

export type SystemHealth = 'operational' | 'degraded' | 'no_data'
/** Farm-wide live counters (GET /api/metrics/live). */
export interface LiveMetrics {
  camerasTotal: number
  camerasOnline: number
  staleCameras: number
  cattleInside: number
  cattleOutside: number
  cattleTotal: number
  openAlerts: number
  eventsLastHour: number
  systemStatus: SystemHealth
  generatedAt: Date
}

export type LotKind = 'paddock' | 'stable' | 'pen' | 'pasture'
export interface Lot {
  id: string
  name: string
  kind: LotKind
  areaSquareMeters: number | null
  capacity: number | null
  /** Camera that watches this lot, if any. */
  cameraId: string | null
  active: boolean
}

/** Latest head count reported by the AI for one camera. */
export interface Occupancy { cameraId: string; inside: number; outside: number; observedAt: Date }

/** One minute of the head-count history of one camera. */
export interface OccupancySample { cameraId: string; minute: Date; inside: number; outside: number }

export interface AlertDay { day: string; total: number; info: number; warning: number; critical: number; open: number; acknowledged: number; resolved: number }
export interface AlertReport { days: AlertDay[]; total: number; avgMinutesToAcknowledge: number | null; avgMinutesToResolve: number | null }
