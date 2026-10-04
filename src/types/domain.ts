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
export interface Camera { id: string; name: string; location: string; status: CameraStatus; lastSeenAt: Date | null }
// Coordinates range from 0 to 1.
export type NormalizedBounds = readonly [xMin: number, yMin: number, xMax: number, yMax: number]
export interface SafeZone { id: string; cameraId: string; name: string; bounds: NormalizedBounds }
// Coordinates range from 0 to 1, with a top-left origin.
export interface NormalizedBox { x: number; y: number; width: number; height: number }
export interface Detection { id: string; label: string; confidence: number; box: NormalizedBox; insideSafeZone: boolean | null }
export interface FrameDetections { cameraId: string; capturedAt: Date; detections: Detection[] }
export interface SystemStatus {
  backend: 'online' | 'offline'
  aiConfigured: boolean | null
  version: string | null
  storage: string | null
  checkedAt: Date
}
export interface Farm { id: string; name: string }
export type UserRole = 'owner' | 'worker'
