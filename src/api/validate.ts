import { eventCatalog } from '../lib/eventCatalog'
import type { ApiAnimalsResponse, ApiCamera, ApiCamerasResponse, ApiEvent, ApiEventsResponse, ApiLiveDetection, ApiLiveStatus, ApiStatus } from '../types/api'
import { ApiError } from './errors'

function isObject(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function invalid(message: string): never { throw new ApiError('parse', message) }

export function isHealthy(body: unknown): boolean {
  return isObject(body) && body.status === 'ok'
}

export function parseStatusResponse(body: unknown): ApiStatus {
  if (!isObject(body) || typeof body.status !== 'string' || typeof body.version !== 'string' ||
    !isObject(body.ai_service) || typeof body.ai_service.configured !== 'boolean' || typeof body.storage !== 'string') {
    return invalid('Invalid status response')
  }
  return { status: body.status, version: body.version, ai_service: { configured: body.ai_service.configured }, storage: body.storage }
}

export function parseAnimalsResponse(body: unknown): ApiAnimalsResponse {
  if (!isObject(body) || !Array.isArray(body.items) || typeof body.total !== 'number' || !Number.isFinite(body.total)) return invalid('Invalid animals response')
  const items = body.items.map((item: unknown) => {
    if (!isObject(item) || typeof item.id !== 'string' || typeof item.tag !== 'string') return invalid('Invalid animal item')
    return { id: item.id, tag: item.tag }
  })
  return { items, total: body.total }
}

export function parseEventsResponse(body: unknown): ApiEventsResponse {
  if (!isObject(body) || !Array.isArray(body.items) || typeof body.total !== 'number' || !Number.isFinite(body.total)) return invalid('Invalid events response')
  const unknownTypes = new Set<string>()
  const items: ApiEvent[] = []
  for (const item of body.items) {
    if (!isObject(item) || typeof item.id !== 'string' || typeof item.event_type !== 'string' ||
      typeof item.camera_id !== 'string' || typeof item.detected_object !== 'string' ||
      typeof item.confidence !== 'number' || !Number.isFinite(item.confidence) ||
      typeof item.timestamp !== 'string' || Number.isNaN(Date.parse(item.timestamp)) ||
      typeof item.received_at !== 'string' || Number.isNaN(Date.parse(item.received_at))) return invalid('Invalid event item')
    if (!Object.hasOwn(eventCatalog, item.event_type)) {
      unknownTypes.add(item.event_type)
      continue
    }
    items.push({ id: item.id, event_type: item.event_type as ApiEvent['event_type'], camera_id: item.camera_id,
      detected_object: item.detected_object, confidence: item.confidence, timestamp: item.timestamp, received_at: item.received_at })
  }
  if (unknownTypes.size) console.warn(`Unknown event types: ${[...unknownTypes].join(', ')}`)
  return { items, total: body.total }
}

const cameraStatuses = new Set(['online', 'offline', 'error'])
const isTimestamp = (value: unknown) => typeof value === 'string' && !Number.isNaN(Date.parse(value))
const isSize = (value: unknown) => value === null || (typeof value === 'number' && Number.isInteger(value) && value > 0)

export function parseCamerasResponse(body: unknown): ApiCamerasResponse {
  if (!isObject(body) || !Array.isArray(body.items) || typeof body.total !== 'number' || !Number.isFinite(body.total)) return invalid('Invalid cameras response')
  const items = body.items.map((item: unknown): ApiCamera => {
    if (!isObject(item) || typeof item.id !== 'string' || typeof item.status !== 'string' || !cameraStatuses.has(item.status) ||
      (item.last_online_at != null && !isTimestamp(item.last_online_at)) ||
      !isSize(item.frame_width ?? null) || !isSize(item.frame_height ?? null) ||
      (item.stream_url != null && (typeof item.stream_url !== 'string' || !/^https?:\/\//.test(item.stream_url)))) return invalid('Invalid camera item')
    return { id: item.id, status: item.status as ApiCamera['status'], last_online_at: (item.last_online_at as string | null | undefined) ?? null,
      frame_width: (item.frame_width as number | null | undefined) ?? null, frame_height: (item.frame_height as number | null | undefined) ?? null,
      stream_url: (item.stream_url as string | null | undefined) ?? null }
  })
  return { items, total: body.total }
}

export function parseLiveStatus(body: unknown): ApiLiveStatus {
  if (!isObject(body) || typeof body.camera_id !== 'string' || typeof body.status !== 'string' ||
    !isSize(body.width ?? null) || !isSize(body.height ?? null) ||
    (body.captured_at != null && !isTimestamp(body.captured_at)) || !Array.isArray(body.detections)) return invalid('Invalid live status')
  const detections = body.detections.map((item: unknown): ApiLiveDetection => {
    if (!isObject(item) || typeof item.class !== 'string' || typeof item.confidence !== 'number' || !Number.isFinite(item.confidence) ||
      !Array.isArray(item.bbox) || item.bbox.length !== 4 || item.bbox.some(value => typeof value !== 'number' || !Number.isFinite(value)) ||
      !(item.inside_zone === null || item.inside_zone === undefined || typeof item.inside_zone === 'boolean')) return invalid('Invalid live detection')
    return { class: item.class, confidence: item.confidence, bbox: item.bbox as ApiLiveDetection['bbox'], inside_zone: (item.inside_zone as boolean | null | undefined) ?? null }
  })
  return { camera_id: body.camera_id, status: body.status, width: (body.width as number | null | undefined) ?? null,
    height: (body.height as number | null | undefined) ?? null, captured_at: (body.captured_at as string | null | undefined) ?? null, detections }
}
