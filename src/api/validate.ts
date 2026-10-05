import { eventCatalog } from '../lib/eventCatalog'
import type { ApiAnimalsResponse, ApiEvent, ApiEventsResponse, ApiStatus } from '../types/api'
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
