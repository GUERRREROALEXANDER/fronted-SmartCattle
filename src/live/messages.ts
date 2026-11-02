import { parseAlert, parseOccupancy, parseStreamDetection, isObject } from '../api/parsers'
import { parseCamerasResponse, parseEventsResponse } from '../api/validate'
import { toAlert, toCamera, toFarmEvent, toStreamFrame } from '../services/mappers'
import type { Alert, Camera, FarmEvent, FrameDetections, Occupancy } from '../types/domain'

/** What the dashboard reacts to on /ws/live, already validated and mapped to domain types. */
export type LiveMessage =
  | { type: 'hello'; role: string }
  | { type: 'event.created'; event: FarmEvent }
  | { type: 'alert.created' | 'alert.updated'; alert: Alert }
  | { type: 'camera.status'; camera: Camera }
  | { type: 'camera.removed'; cameraId: string }
  | { type: 'occupancy.updated'; occupancy: Occupancy }
  | { type: 'detections'; frame: FrameDetections }
  | { type: 'pong' }

/**
 * Reads one frame of the live stream. Unknown types (video progress, future additions) and frames that
 * break the contract return null: one bad message must never take the dashboard down.
 */
export function parseLiveMessage(raw: unknown): LiveMessage | null {
  let body: unknown = raw
  if (typeof raw === 'string') {
    try { body = JSON.parse(raw) } catch { return null }
  }
  if (!isObject(body) || typeof body.type !== 'string') return null
  const data = body.data
  try {
    switch (body.type) {
      case 'hello':
        return { type: 'hello', role: isObject(data) && typeof data.role === 'string' ? data.role : 'worker' }
      case 'pong':
        return { type: 'pong' }
      case 'event.created': {
        const [event] = parseEventsResponse({ items: [data], total: 1 }).items
        return event ? { type: 'event.created', event: toFarmEvent(event) } : null
      }
      case 'alert.created':
      case 'alert.updated':
        return { type: body.type, alert: toAlert(parseAlert(data)) }
      case 'camera.status': {
        const [camera] = parseCamerasResponse({ items: [data], total: 1 }).items
        return { type: 'camera.status', camera: toCamera(camera) }
      }
      case 'camera.removed':
        return isObject(data) && typeof data.id === 'string' ? { type: 'camera.removed', cameraId: data.id } : null
      case 'occupancy.updated': {
        const occupancy = parseOccupancy(data)
        return {
          type: 'occupancy.updated',
          occupancy: { cameraId: occupancy.camera_id, inside: occupancy.cattle_inside, outside: occupancy.cattle_outside, observedAt: new Date(occupancy.observed_at) },
        }
      }
      case 'detections': {
        if (!isObject(data) || typeof data.camera_id !== 'string' || typeof data.observed_at !== 'string' ||
          Number.isNaN(Date.parse(data.observed_at)) || !Array.isArray(data.detections)) return null
        return { type: 'detections', frame: toStreamFrame(data.camera_id, data.observed_at, data.detections.map(parseStreamDetection)) }
      }
      default:
        return null
    }
  } catch {
    return null
  }
}
