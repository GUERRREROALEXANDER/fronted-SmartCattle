export interface ApiHealth { status: string }
export interface ApiStatus {
  status: string
  version: string
  ai_service: { configured: boolean }
  storage: string
  /** Whether JWT_SECRET is set; null on backends that predate the flag. */
  auth_enabled: boolean | null
}
export type ApiAnimalStatus = 'active' | 'inactive' | 'lost'
export interface ApiAnimal {
  tag: string
  name: string | null
  status: ApiAnimalStatus
  camera_id: string | null
  last_detection: string | null
}
export interface ApiAnimalsResponse { items: ApiAnimal[]; total: number }
export type ApiEventLevel = 'low' | 'medium' | 'high'
export interface ApiEvent {
  id: string
  event_type: 'cattle_out_of_zone'
  camera_id: string
  detected_object: string
  confidence: number // 0..1
  timestamp: string // ISO timestamp with timezone.
  received_at: string // ISO timestamp in UTC.
  /** Severity the backend derives from the confidence; absent on older backends. */
  level: ApiEventLevel | null
}
// Items are ordered newest first.
export interface ApiEventsResponse { items: ApiEvent[]; total: number }
export interface ApiErrorBody { detail: string | unknown }
export interface ApiCamera {
  id: string
  status: 'online' | 'offline' | 'error'
  last_online_at: string | null // ISO timestamp in UTC.
  frame_width: number | null
  frame_height: number | null
  stream_url: string | null // Public base URL of the AI service streaming this camera.
  last_error: string | null
  fps: number | null
}
export interface ApiCamerasResponse { items: ApiCamera[]; total: number }
export type ApiUserRole = 'owner' | 'worker'
export interface ApiUser { id: number; email: string; full_name: string; role: ApiUserRole; is_active: boolean }
export interface ApiTokenResponse { access_token: string; expires_in: number; user: ApiUser }

export type ApiAlertStatus = 'open' | 'acknowledged' | 'resolved'
export interface ApiAlert {
  id: string
  event_id: string | null
  camera_id: string | null
  alert_type: string
  severity: ApiEventLevel
  status: ApiAlertStatus
  message: string
  created_at: string
  acknowledged_at: string | null
  resolved_at: string | null
}
export interface ApiAlertsResponse { items: ApiAlert[]; total: number }

export type ApiSystemStatus = 'operational' | 'degraded' | 'no_data'
/** GET /api/metrics/live */
export interface ApiLiveMetrics {
  cameras_total: number
  cameras_online: number
  stale_cameras: number
  cattle_inside: number
  cattle_outside: number
  cattle_total: number
  open_alerts: number
  events_last_hour: number
  system_status: ApiSystemStatus
  generated_at: string
}

export interface ApiFarm { id: number; name: string; location: string | null; area_hectares: number | null; lot_count: number }
export interface ApiFarmsResponse { items: ApiFarm[]; total: number }
export type ApiLotKind = 'paddock' | 'stable' | 'pen' | 'pasture'
export interface ApiLot {
  id: number
  farm_id: number
  name: string
  kind: ApiLotKind
  area_square_meters: number | null
  length_meters: number | null
  width_meters: number | null
  capacity: number | null
  camera_id: string | null
  active: boolean
}
export interface ApiLotsResponse { items: ApiLot[]; total: number }

export interface ApiZone {
  id: number
  camera_id: string
  name: string
  x_min: number
  y_min: number
  x_max: number
  y_max: number
  outline: { x: number; y: number }[] | null
  active: boolean
}
export interface ApiZonesResponse { items: ApiZone[]; total: number }

export interface ApiOccupancySample { camera_id: string; minute: string; cattle_inside: number; cattle_outside: number }
export interface ApiOccupancyHistory { items: ApiOccupancySample[]; total: number }
export interface ApiAlertDay { day: string; total: number; low: number; medium: number; high: number; open: number; acknowledged: number; resolved: number }
export interface ApiAlertReport { days: ApiAlertDay[]; total: number; avg_minutes_to_acknowledge: number | null; avg_minutes_to_resolve: number | null }
export interface ApiEventDay { day: string; camera_id: string; total: number; low: number; medium: number; high: number }
export interface ApiEventReport { days: ApiEventDay[]; total: number }

/** One box pushed by the backend on /ws/live; `bbox` is [x1, y1, x2, y2] from 0 to 1. */
export interface ApiStreamDetection {
  track_id: number | null
  label: string
  confidence: number
  bbox: [x1: number, y1: number, x2: number, y2: number]
  inside_zone: boolean
}
export interface ApiOccupancy { camera_id: string; cattle_inside: number; cattle_outside: number; observed_at: string }

/** GET /status on the local AI service (live.py). */
export interface ApiLiveDetection {
  class: string
  confidence: number // 0..1
  bbox: [x1: number, y1: number, x2: number, y2: number] // Pixels.
  inside_zone: boolean | null
}
export interface ApiLiveStatus {
  camera_id: string
  status: string
  width: number | null
  height: number | null
  captured_at: string | null
  detections: ApiLiveDetection[]
}
