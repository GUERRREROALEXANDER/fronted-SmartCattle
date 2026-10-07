export interface ApiHealth { status: string }
export interface ApiStatus {
  status: string
  version: string
  ai_service: { configured: boolean }
  storage: string
}
export interface ApiAnimal { id: string; tag: string }
export interface ApiAnimalsResponse { items: ApiAnimal[]; total: number }
export interface ApiEvent {
  id: string
  event_type: 'cattle_out_of_zone'
  camera_id: string
  detected_object: string
  confidence: number // 0..1
  timestamp: string // ISO timestamp with timezone.
  received_at: string // ISO timestamp in UTC.
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
