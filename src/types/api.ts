export interface ApiHealth { status: string }
export interface ApiStatus {
  status: string
  version: string
  ai_service: { configured: boolean }
  storage: string
  /** Absent on a backend that predates the field, which reads as unknown. */
  auth_enabled?: boolean
}
/**
 * GET /api/animals. The ear tag is the identity; there is no numeric id,
 * because the tag is what is physically on the animal and what the staff use.
 */
export interface ApiAnimal {
  tag: string
  name: string | null
  status: 'active' | 'inactive' | 'lost'
  camera_id: string | null
  last_detection: string | null // ISO timestamp in UTC.
  created_at: string
  updated_at: string
}
export interface ApiAnimalsResponse { items: ApiAnimal[]; total: number }
export interface ApiEvent {
  id: string
  event_type: 'cattle_out_of_zone'
  camera_id: string
  detected_object: string
  confidence: number // 0..1
  timestamp: string // ISO timestamp with timezone.
  received_at: string // ISO timestamp in UTC.
  /** Severity, derived by the backend from the confidence. */
  level: 'low' | 'medium' | 'high'
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
}
export interface ApiCamerasResponse { items: ApiCamera[]; total: number }
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

/** A polygon vertex. Normalised from 0 to 1, not pixels. */
export interface ApiZonePoint { x: number; y: number }

/**
 * GET /api/zones. Coordinates are normalised from 0 to 1 rather than stored
 * in pixels: a zone in pixels is tied to the resolution it was drawn at, so
 * swapping the camera moves the zone without anyone touching it.
 */
export interface ApiZone {
  id: number
  camera_id: string
  name: string
  x_min: number
  y_min: number
  x_max: number
  y_max: number
  /** Optional polygon. When present it defines the zone; the rectangle is its bounding box. */
  outline: ApiZonePoint[] | null
  active: boolean
  created_at: string
}
export interface ApiZonesResponse { items: ApiZone[]; total: number }
