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
