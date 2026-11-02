import type { Alert, Camera, FarmEvent, FrameDetections, LiveMetrics, Occupancy } from '../types/domain'
import type { LiveMessage } from './messages'

export type LiveConnection =
  /** First load in progress. */
  | 'connecting'
  /** WebSocket authenticated: changes arrive as they happen. */
  | 'live'
  /** No push channel (backend without JWT, or socket down): the data is refreshed every few seconds. */
  | 'polling'
  /** Nothing reaches the backend; what is on screen is the last known state. */
  | 'offline'
  /** Mock mode: a local generator plays the AI service. */
  | 'demo'

export interface HerdPoint { at: Date; inside: number; outside: number }

export interface LiveState {
  connection: LiveConnection
  metrics: LiveMetrics | null
  /** Every camera the AI service reported, online or not. */
  cameras: Camera[]
  occupancy: Record<string, Occupancy>
  /** Latest boxes per camera; dropped once stale so a frozen frame never reads as live. */
  frames: Record<string, FrameDetections>
  /** Open and acknowledged alerts, newest first. */
  alerts: Alert[]
  /** Latest detections, newest first. */
  events: FarmEvent[]
  /** Farm-wide head count over this session, for the live chart. */
  history: HerdPoint[]
  updatedAt: Date | null
}

export type LiveAction =
  | { type: 'snapshot'; at: Date; metrics?: LiveMetrics; cameras?: Camera[]; alerts?: Alert[]; events?: FarmEvent[] }
  | { type: 'message'; at: Date; message: LiveMessage }
  | { type: 'connection'; connection: LiveConnection }
  | { type: 'prune'; at: Date }

export const FRAME_TTL_MS = 12_000
const HISTORY_LIMIT = 240
const HISTORY_STEP_MS = 3_000
const EVENT_LIMIT = 60
const ALERT_LIMIT = 100

export const initialLiveState: LiveState = {
  connection: 'connecting', metrics: null, cameras: [], occupancy: {}, frames: {}, alerts: [], events: [], history: [], updatedAt: null,
}

export interface HerdCount { inside: number; outside: number; total: number }

/**
 * The farm's head count right now. Once every online camera has pushed its own count, their sum is the
 * freshest number; until then the backend's last metrics are. Null before any camera reported.
 */
export function herdCount(state: Pick<LiveState, 'metrics' | 'cameras' | 'occupancy'>): HerdCount | null {
  const online = state.cameras.filter(camera => camera.status === 'online')
  if (online.length > 0 && online.every(camera => state.occupancy[camera.id])) {
    let inside = 0
    let outside = 0
    for (const camera of online) {
      inside += state.occupancy[camera.id].inside
      outside += state.occupancy[camera.id].outside
    }
    return { inside, outside, total: inside + outside }
  }
  if (!state.metrics || state.metrics.camerasTotal === 0) return null
  return { inside: state.metrics.cattleInside, outside: state.metrics.cattleOutside, total: state.metrics.cattleTotal }
}

function withHistory(history: HerdPoint[], count: HerdCount | null, at: Date): HerdPoint[] {
  if (!count) return history
  const point = { at, inside: count.inside, outside: count.outside }
  const last = history.at(-1)
  // Bursts of pushes collapse into one point every few seconds.
  if (last && at.getTime() - last.at.getTime() < HISTORY_STEP_MS) return [...history.slice(0, -1), { ...point, at: last.at }]
  return [...history, point].slice(-HISTORY_LIMIT)
}

function upsertAlert(alerts: Alert[], alert: Alert): Alert[] {
  const rest = alerts.filter(item => item.id !== alert.id)
  if (alert.status === 'resolved') return rest
  return [alert, ...rest].sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime()).slice(0, ALERT_LIMIT)
}

function countOnline(cameras: readonly Camera[]) {
  return cameras.filter(camera => camera.status === 'online').length
}

function applyMessage(state: LiveState, message: LiveMessage, at: Date): LiveState {
  const metrics = state.metrics
  switch (message.type) {
    case 'occupancy.updated': {
      const { occupancy } = message
      const previous = state.occupancy[occupancy.cameraId]
      if (previous && previous.observedAt > occupancy.observedAt) return state
      const next = { ...state, occupancy: { ...state.occupancy, [occupancy.cameraId]: occupancy } }
      return { ...next, history: withHistory(state.history, herdCount(next), at) }
    }
    case 'detections':
      return { ...state, frames: { ...state.frames, [message.frame.cameraId]: message.frame } }
    case 'alert.created':
    case 'alert.updated': {
      // An update for an alert this list never held cannot be counted here; the next metrics refresh settles it.
      const wasOpen = state.alerts.find(item => item.id === message.alert.id)?.status === 'open'
      const delta = Number(message.alert.status === 'open') - Number(wasOpen)
      return {
        ...state, alerts: upsertAlert(state.alerts, message.alert),
        metrics: metrics && { ...metrics, openAlerts: Math.max(0, metrics.openAlerts + delta) },
      }
    }
    case 'camera.status': {
      const exists = state.cameras.some(camera => camera.id === message.camera.id)
      const cameras = exists
        ? state.cameras.map(camera => camera.id === message.camera.id ? message.camera : camera)
        : [...state.cameras, message.camera].sort((a, b) => a.id.localeCompare(b.id))
      return {
        ...state, cameras,
        metrics: metrics && { ...metrics, camerasOnline: countOnline(cameras), camerasTotal: cameras.length },
      }
    }
    case 'camera.removed': {
      const cameras = state.cameras.filter(camera => camera.id !== message.cameraId)
      const without = <T,>(items: Record<string, T>) => Object.fromEntries(Object.entries(items).filter(([id]) => id !== message.cameraId))
      return {
        ...state, cameras, occupancy: without(state.occupancy), frames: without(state.frames),
        metrics: metrics && { ...metrics, camerasOnline: countOnline(cameras), camerasTotal: cameras.length },
      }
    }
    case 'event.created':
      if (state.events.some(event => event.id === message.event.id)) return state
      return {
        ...state, events: [message.event, ...state.events].slice(0, EVENT_LIMIT),
        metrics: metrics && { ...metrics, eventsLastHour: metrics.eventsLastHour + 1 },
      }
    default:
      return state
  }
}

export function liveReducer(state: LiveState, action: LiveAction): LiveState {
  switch (action.type) {
    case 'connection':
      return state.connection === action.connection ? state : { ...state, connection: action.connection }
    case 'snapshot': {
      const next = {
        ...state,
        metrics: action.metrics ?? state.metrics,
        cameras: action.cameras ?? state.cameras,
        alerts: action.alerts ? action.alerts.filter(alert => alert.status !== 'resolved').slice(0, ALERT_LIMIT) : state.alerts,
        events: action.events ? action.events.slice(0, EVENT_LIMIT) : state.events,
        updatedAt: action.at,
      }
      return { ...next, history: withHistory(state.history, herdCount(next), action.at) }
    }
    case 'message': {
      const next = applyMessage(state, action.message, action.at)
      return next === state ? state : { ...next, updatedAt: action.at }
    }
    case 'prune': {
      const stale = Object.values(state.frames).filter(frame => action.at.getTime() - frame.capturedAt.getTime() > FRAME_TTL_MS)
      if (stale.length === 0) return state
      const frames = { ...state.frames }
      for (const frame of stale) delete frames[frame.cameraId]
      return { ...state, frames }
    }
  }
}
