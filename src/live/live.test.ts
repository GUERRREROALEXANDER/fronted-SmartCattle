import { afterEach, describe, expect, it, vi } from 'vitest'
import type { Alert, Camera, LiveMetrics } from '../types/domain'
import { herdCount, initialLiveState, liveReducer, type LiveState } from './liveState'
import { liveSocketUrl, openLiveSocket } from './liveSocket'
import { parseLiveMessage } from './messages'

const at = new Date('2026-10-31T15:00:00Z')
const camera = (id: string, status: Camera['status'] = 'online'): Camera => ({ id, name: id, location: '', status, lastSeenAt: at })
const metrics: LiveMetrics = {
  camerasTotal: 2, camerasOnline: 2, staleCameras: 0, cattleInside: 9, cattleOutside: 1, cattleTotal: 10, openAlerts: 1,
  eventsLastHour: 4, systemStatus: 'operational', generatedAt: at,
}
const alert = (id: string, status: Alert['status'] = 'open'): Alert => ({
  id, eventId: null, cameraId: 'camera-01', kind: 'cattle_out_of_zone', message: 'Fuera', severity: 'critical', status,
  createdAt: at, acknowledgedAt: null, resolvedAt: null,
})
const loaded = (): LiveState => liveReducer(initialLiveState, {
  type: 'snapshot', at, metrics, cameras: [camera('camera-01'), camera('camera-02')], alerts: [alert('a1')], events: [],
})

describe('parseLiveMessage', () => {
  it('reads a detections push with normalised boxes and track ids', () => {
    const message = parseLiveMessage(JSON.stringify({
      type: 'detections', sent_at: at.toISOString(),
      data: { camera_id: 'camera-01', observed_at: at.toISOString(), detections: [
        { track_id: 7, label: 'cow', confidence: 0.91, bbox: [0.1, 0.2, 0.3, 0.5], inside_zone: false },
      ] },
    }))
    expect(message).toEqual({ type: 'detections', frame: { cameraId: 'camera-01', capturedAt: at, detections: [
      { id: 'camera-01#7', trackId: 7, label: 'cow', confidence: 0.91, insideSafeZone: false, box: { x: 0.1, y: 0.2, width: expect.closeTo(0.2), height: expect.closeTo(0.3) } },
    ] } })
  })
  it('ignores unknown types and broken frames instead of throwing', () => {
    expect(parseLiveMessage('{"type":"video.progress","data":{}}')).toBeNull()
    expect(parseLiveMessage('{"type":"detections","data":{"camera_id":"c"}}')).toBeNull()
    expect(parseLiveMessage('not json')).toBeNull()
    expect(parseLiveMessage('{"type":"camera.removed","data":{}}')).toBeNull()
  })
  it('reads the removal of a camera', () => {
    expect(parseLiveMessage('{"type":"camera.removed","data":{"id":"cam-1"}}')).toEqual({ type: 'camera.removed', cameraId: 'cam-1' })
  })
})

describe('liveReducer', () => {
  it('counts the herd from the backend until every online camera pushed its own count', () => {
    let state = loaded()
    expect(herdCount(state)).toEqual({ inside: 9, outside: 1, total: 10 })
    state = liveReducer(state, { type: 'message', at, message: { type: 'occupancy.updated', occupancy: { cameraId: 'camera-01', inside: 4, outside: 0, observedAt: at } } })
    expect(herdCount(state)).toEqual({ inside: 9, outside: 1, total: 10 })
    state = liveReducer(state, { type: 'message', at, message: { type: 'occupancy.updated', occupancy: { cameraId: 'camera-02', inside: 5, outside: 2, observedAt: at } } })
    expect(herdCount(state)).toEqual({ inside: 9, outside: 2, total: 11 })
  })
  it('ignores an occupancy older than the one it has', () => {
    const newer = { cameraId: 'camera-01', inside: 4, outside: 0, observedAt: at }
    let state = liveReducer(loaded(), { type: 'message', at, message: { type: 'occupancy.updated', occupancy: newer } })
    state = liveReducer(state, { type: 'message', at, message: { type: 'occupancy.updated', occupancy: { ...newer, inside: 1, observedAt: new Date(at.getTime() - 1000) } } })
    expect(state.occupancy['camera-01'].inside).toBe(4)
  })
  it('keeps the open alert count in step with pushes and drops resolved alerts', () => {
    let state = liveReducer(loaded(), { type: 'message', at, message: { type: 'alert.created', alert: alert('a2') } })
    expect(state.metrics?.openAlerts).toBe(2)
    state = liveReducer(state, { type: 'message', at, message: { type: 'alert.updated', alert: alert('a1', 'acknowledged') } })
    expect(state.metrics?.openAlerts).toBe(1)
    state = liveReducer(state, { type: 'message', at, message: { type: 'alert.updated', alert: alert('a1', 'resolved') } })
    expect(state.alerts.map(item => item.id)).toEqual(['a2'])
    expect(state.metrics?.openAlerts).toBe(1)
  })
  it('adds a camera that reports for the first time and counts it online', () => {
    const state = liveReducer(loaded(), { type: 'message', at, message: { type: 'camera.status', camera: camera('camera-03') } })
    expect(state.cameras.map(item => item.id)).toEqual(['camera-01', 'camera-02', 'camera-03'])
    expect(state.metrics).toMatchObject({ camerasTotal: 3, camerasOnline: 3 })
  })
  it('forgets a camera that was removed, on every screen at once', () => {
    const frame = { cameraId: 'camera-02', capturedAt: at, detections: [] }
    let state = liveReducer(loaded(), { type: 'message', at, message: { type: 'detections', frame } })
    state = liveReducer(state, { type: 'message', at, message: { type: 'camera.removed', cameraId: 'camera-02' } })
    expect(state.cameras.map(item => item.id)).toEqual(['camera-01'])
    expect(state.frames['camera-02']).toBeUndefined()
    expect(state.metrics).toMatchObject({ camerasTotal: 1 })
  })
  it('drops boxes once they are stale', () => {
    const frame = { cameraId: 'camera-01', capturedAt: at, detections: [] }
    let state = liveReducer(loaded(), { type: 'message', at, message: { type: 'detections', frame } })
    state = liveReducer(state, { type: 'prune', at: new Date(at.getTime() + 5_000) })
    expect(state.frames['camera-01']).toBe(frame)
    state = liveReducer(state, { type: 'prune', at: new Date(at.getTime() + 13_000) })
    expect(state.frames['camera-01']).toBeUndefined()
  })
})

class FakeSocket {
  static last: FakeSocket
  readyState = 0
  sent: string[] = []
  onopen: (() => void) | null = null
  onmessage: ((event: { data: string }) => void) | null = null
  onclose: ((event: { code: number }) => void) | null = null
  onerror: (() => void) | null = null
  constructor(readonly url: string) { FakeSocket.last = this }
  send(data: string) { this.sent.push(data) }
  close() { this.readyState = 3 }
  open() { this.readyState = 1; this.onopen?.() }
  push(body: unknown) { this.onmessage?.({ data: JSON.stringify(body) }) }
  drop(code: number) { this.readyState = 3; this.onclose?.({ code }) }
}

describe('openLiveSocket', () => {
  afterEach(() => vi.useRealTimers())
  const start = (getToken: () => string | null = () => 'jwt') => {
    const states: string[] = []
    const messages: unknown[] = []
    const socket = openLiveSocket({
      url: liveSocketUrl('https://api.example.com'), getToken, onMessage: message => messages.push(message),
      onState: state => states.push(state), createSocket: url => new FakeSocket(url) as unknown as WebSocket,
    })
    return { states, messages, socket }
  }

  it('authenticates in the first message and goes live on hello', () => {
    const { states } = start()
    expect(FakeSocket.last.url).toBe('wss://api.example.com/ws/live')
    FakeSocket.last.open()
    expect(JSON.parse(FakeSocket.last.sent[0])).toEqual({ type: 'auth', token: 'jwt' })
    FakeSocket.last.push({ type: 'hello', data: { user_id: 1, role: 'owner' } })
    expect(states).toEqual(['connecting', 'live'])
  })
  it('reconnects with backoff after a dropped connection', () => {
    vi.useFakeTimers()
    const { states } = start()
    const first = FakeSocket.last
    first.drop(1006)
    expect(states.at(-1)).toBe('reconnecting')
    vi.advanceTimersByTime(1000)
    expect(FakeSocket.last).not.toBe(first)
  })
  it.each([[4401, 'unauthorized'], [4503, 'unsupported']] as const)('stops for good on close %i', (code, state) => {
    vi.useFakeTimers()
    const { states } = start()
    const first = FakeSocket.last
    first.drop(code)
    vi.advanceTimersByTime(60_000)
    expect(states.at(-1)).toBe(state)
    expect(FakeSocket.last).toBe(first)
  })
  it('does not open without a token', () => {
    expect(start(() => null).states).toEqual(['unauthorized'])
  })
})
