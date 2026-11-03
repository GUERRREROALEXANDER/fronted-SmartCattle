import type {
  ApiAlert, ApiAlertDay, ApiAlertReport, ApiAlertsResponse, ApiEventDay, ApiEventLevel, ApiEventReport, ApiFarm,
  ApiFarmsResponse, ApiLiveMetrics, ApiLot, ApiLotsResponse, ApiOccupancy, ApiOccupancyHistory, ApiStreamDetection,
  ApiUser,
} from '../types/api'
import { ApiError } from './errors'

// Parsers for the backend responses added with the full integration. Each one rejects a body that
// does not match the contract instead of letting a half-valid object reach the screens.

type Json = Record<string, unknown>

export function isObject(value: unknown): value is Json {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
}

function invalid(what: string): never { throw new ApiError('parse', `Invalid ${what}`) }

const isString = (value: unknown): value is string => typeof value === 'string'
const isNumber = (value: unknown): value is number => typeof value === 'number' && Number.isFinite(value)
const isCount = (value: unknown): value is number => isNumber(value) && Number.isInteger(value) && value >= 0
const isTimestamp = (value: unknown): value is string => isString(value) && !Number.isNaN(Date.parse(value))
const isUnit = (value: unknown): value is number => isNumber(value) && value >= 0 && value <= 1
const optional = <T>(value: unknown, check: (value: unknown) => value is T): T | null =>
  value === null || value === undefined ? null : check(value) ? value : invalid('optional field')
const oneOf = <T extends string>(values: readonly T[]) => (value: unknown): value is T => isString(value) && (values as readonly string[]).includes(value)

export const isLevel = oneOf<ApiEventLevel>(['low', 'medium', 'high'])

function list<T>(body: unknown, what: string, item: (value: unknown) => T): { items: T[]; total: number } {
  if (!isObject(body) || !Array.isArray(body.items) || !isCount(body.total)) return invalid(what)
  return { items: body.items.map(item), total: body.total }
}

export function parseUser(value: unknown): ApiUser {
  if (!isObject(value) || !isCount(value.id) || !isString(value.email) || !isString(value.full_name) ||
    !oneOf(['owner', 'worker'] as const)(value.role) || typeof value.is_active !== 'boolean') return invalid('user')
  return { id: value.id, email: value.email, full_name: value.full_name, role: value.role, is_active: value.is_active }
}

export function parseAlert(value: unknown): ApiAlert {
  if (!isObject(value) || !isString(value.id) || !isString(value.alert_type) || !isLevel(value.severity) ||
    !oneOf(['open', 'acknowledged', 'resolved'] as const)(value.status) || !isString(value.message) ||
    !isTimestamp(value.created_at)) return invalid('alert')
  return {
    id: value.id, event_id: optional(value.event_id, isString), camera_id: optional(value.camera_id, isString),
    alert_type: value.alert_type, severity: value.severity, status: value.status, message: value.message,
    created_at: value.created_at, acknowledged_at: optional(value.acknowledged_at, isTimestamp),
    resolved_at: optional(value.resolved_at, isTimestamp),
  }
}

export const parseAlertsResponse = (body: unknown): ApiAlertsResponse => list(body, 'alerts response', parseAlert)

export function parseLiveMetrics(body: unknown): ApiLiveMetrics {
  if (!isObject(body)) return invalid('live metrics')
  const counts = ['cameras_total', 'cameras_online', 'stale_cameras', 'cattle_inside', 'cattle_outside', 'cattle_total', 'open_alerts', 'events_last_hour'] as const
  if (counts.some(key => !isCount(body[key])) || !oneOf(['operational', 'degraded', 'no_data'] as const)(body.system_status) ||
    !isTimestamp(body.generated_at)) return invalid('live metrics')
  return {
    cameras_total: body.cameras_total as number, cameras_online: body.cameras_online as number, stale_cameras: body.stale_cameras as number,
    cattle_inside: body.cattle_inside as number, cattle_outside: body.cattle_outside as number, cattle_total: body.cattle_total as number,
    open_alerts: body.open_alerts as number, events_last_hour: body.events_last_hour as number,
    system_status: body.system_status, generated_at: body.generated_at,
  }
}

export function parseFarm(value: unknown): ApiFarm {
  if (!isObject(value) || !isCount(value.id) || !isString(value.name) || !isCount(value.lot_count)) return invalid('farm')
  return { id: value.id, name: value.name, location: optional(value.location, isString), area_hectares: optional(value.area_hectares, isNumber), lot_count: value.lot_count }
}

export const parseFarmsResponse = (body: unknown): ApiFarmsResponse => list(body, 'farms response', parseFarm)

export function parseLot(value: unknown): ApiLot {
  if (!isObject(value) || !isCount(value.id) || !isCount(value.farm_id) || !isString(value.name) ||
    !oneOf(['paddock', 'stable', 'pen', 'pasture'] as const)(value.kind) || typeof value.active !== 'boolean') return invalid('lot')
  return {
    id: value.id, farm_id: value.farm_id, name: value.name, kind: value.kind,
    area_square_meters: optional(value.area_square_meters, isNumber), length_meters: optional(value.length_meters, isNumber),
    width_meters: optional(value.width_meters, isNumber), capacity: optional(value.capacity, isCount),
    camera_id: optional(value.camera_id, isString), active: value.active,
  }
}

export const parseLotsResponse = (body: unknown): ApiLotsResponse => list(body, 'lots response', parseLot)

export function parseOccupancy(value: unknown): ApiOccupancy {
  if (!isObject(value) || !isString(value.camera_id) || !isCount(value.cattle_inside) || !isCount(value.cattle_outside) ||
    !isTimestamp(value.observed_at)) return invalid('occupancy')
  return { camera_id: value.camera_id, cattle_inside: value.cattle_inside, cattle_outside: value.cattle_outside, observed_at: value.observed_at }
}

export function parseStreamDetection(value: unknown): ApiStreamDetection {
  if (!isObject(value) || !isString(value.label) || !isUnit(value.confidence) || !Array.isArray(value.bbox) ||
    value.bbox.length !== 4 || !value.bbox.every(isUnit) || typeof value.inside_zone !== 'boolean') return invalid('detection')
  return {
    track_id: optional(value.track_id, isCount), label: value.label, confidence: value.confidence,
    bbox: value.bbox as ApiStreamDetection['bbox'], inside_zone: value.inside_zone,
    ...(value.posture === 'standing' || value.posture === 'walking' || value.posture === 'lying' ? { posture: value.posture } : {}),
  }
}

export function parseOccupancyHistory(body: unknown): ApiOccupancyHistory {
  return list(body, 'occupancy history', value => {
    if (!isObject(value) || !isString(value.camera_id) || !isTimestamp(value.minute) || !isCount(value.cattle_inside) ||
      !isCount(value.cattle_outside)) return invalid('occupancy sample')
    return { camera_id: value.camera_id, minute: value.minute, cattle_inside: value.cattle_inside, cattle_outside: value.cattle_outside }
  })
}

const isDay = (value: unknown): value is string => isString(value) && /^\d{4}-\d{2}-\d{2}$/.test(value)

export function parseAlertReport(body: unknown): ApiAlertReport {
  if (!isObject(body) || !Array.isArray(body.days) || !isCount(body.total)) return invalid('alert report')
  const keys = ['total', 'low', 'medium', 'high', 'open', 'acknowledged', 'resolved'] as const
  const days = body.days.map((value): ApiAlertDay => {
    if (!isObject(value) || !isDay(value.day) || keys.some(key => !isCount(value[key]))) return invalid('alert day')
    return { day: value.day, total: value.total as number, low: value.low as number, medium: value.medium as number, high: value.high as number,
      open: value.open as number, acknowledged: value.acknowledged as number, resolved: value.resolved as number }
  })
  return {
    days, total: body.total,
    avg_minutes_to_acknowledge: optional(body.avg_minutes_to_acknowledge, isNumber),
    avg_minutes_to_resolve: optional(body.avg_minutes_to_resolve, isNumber),
  }
}

export function parseEventReport(body: unknown): ApiEventReport {
  if (!isObject(body) || !Array.isArray(body.days) || !isCount(body.total)) return invalid('event report')
  const days = body.days.map((value): ApiEventDay => {
    if (!isObject(value) || !isDay(value.day) || !isString(value.camera_id) ||
      (['total', 'low', 'medium', 'high'] as const).some(key => !isCount(value[key]))) return invalid('event day')
    return { day: value.day, camera_id: value.camera_id, total: value.total as number, low: value.low as number,
      medium: value.medium as number, high: value.high as number }
  })
  return { days, total: body.total }
}
