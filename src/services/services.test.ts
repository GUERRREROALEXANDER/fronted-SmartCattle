import { afterEach, describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/errors'
import { tokenStore } from '../api/session'
import { eventCatalog } from '../lib/eventCatalog'
import { buildMockFarmEvents, buildMockFrameDetections, mockCameras, mockDetectedCattle, mockFarm, mockRegisteredCattle, mockSafeZones } from '../mocks/mockData'
import type { ApiEvent } from '../types/api'
import {
  acknowledgeAlert, getCameraStream, getCurrentFarm, getDetectedCattleCount, getFarmPlan, getFrameDetections, getRegisteredCattleCount,
  getSystemStatus, listAlerts, listCameras, listEvents, listSafeZones, resolveAlert,
} from './index'
import { isWithinBounds } from './mappers'

const now = new Date(2026, 9, 3, 16)
const events = buildMockFarmEvents(now)
const backendEvents: ApiEvent[] = events.filter(event => event.kind === 'cattle_out_of_zone').map(event => {
  if (event.detectedObject === null || event.confidence === null) throw new Error('Cattle events require detection data')
  return {
  id: event.id, event_type: 'cattle_out_of_zone', camera_id: event.cameraId, detected_object: event.detectedObject,
  confidence: event.confidence, timestamp: event.occurredAt.toISOString(), received_at: event.receivedAt.toISOString(), level: null,
  }
})

afterEach(() => vi.useRealTimers())

describe('backend services', () => {
  it.each(['api', 'hybrid'] as const)('loads backend events in %s mode', async mode => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ items: backendEvents, total: backendEvents.length }))
    const result = await listEvents({ mode, fetchImpl, now })
    expect(result).toEqual({ data: events.filter(event => event.kind === 'cattle_out_of_zone'), source: 'api' })
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringMatching(/\/api\/events$/), expect.objectContaining({ method: 'GET' }))
  })
  it('orders backend events by detection time, not arrival time', async () => {
    const [newer, older] = [backendEvents[0], { ...backendEvents[1], received_at: new Date(now).toISOString() }]
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ items: [older, newer], total: 2 }))
    expect((await listEvents({ mode: 'api', fetchImpl, now })).data.map(event => event.id)).toEqual([newer.id, older.id])
  })
  it('propagates event errors without falling back to mock data', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(listEvents({ mode: 'hybrid', fetchImpl, now })).rejects.toBeInstanceOf(ApiError)
  })
  it('returns offline status on health network failure', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(getSystemStatus({ mode: 'api', fetchImpl, now })).resolves.toEqual({
      source: 'api', data: { backend: 'offline', aiConfigured: null, version: null, storage: null, checkedAt: now },
    })
    expect(fetchImpl).toHaveBeenCalledOnce()
  })
  it('returns offline status on health HTTP failure', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 503 }))
    expect((await getSystemStatus({ mode: 'api', fetchImpl, now })).data.backend).toBe('offline')
  })
  it('returns offline status on health timeout', async () => {
    vi.useFakeTimers()
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}))
    const result = getSystemStatus({ mode: 'api', fetchImpl, now })
    await vi.advanceTimersByTimeAsync(8000)
    expect((await result).data.backend).toBe('offline')
  })
  it('returns offline on malformed health JSON', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('invalid'))
    expect((await getSystemStatus({ mode: 'api', fetchImpl, now })).data.backend).toBe('offline')
  })
  it('returns offline when health is not ok', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ status: 'degraded' }))
    expect((await getSystemStatus({ mode: 'api', fetchImpl, now })).data.backend).toBe('offline')
    expect(fetchImpl).toHaveBeenCalledOnce()
  })
  it('preserves caller cancellation', async () => {
    const signal = AbortSignal.abort()
    await expect(getSystemStatus({ mode: 'api', signal, now })).rejects.toBe(signal.reason)
  })
  it('maps status fields after successful health and reads the animal total', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ status: 'ok' }))
      .mockResolvedValueOnce(Response.json({ status: 'ok', version: '', ai_service: { configured: false }, storage: '' }))
      .mockResolvedValueOnce(Response.json({ items: [], total: 0 }))
    await expect(getSystemStatus({ mode: 'api', fetchImpl, now })).resolves.toEqual({
      source: 'api', data: { backend: 'online', aiConfigured: false, version: '', storage: '', checkedAt: now },
    })
    await expect(getRegisteredCattleCount({ mode: 'api', fetchImpl, now })).resolves.toEqual({ data: 0, source: 'api' })
    expect(fetchImpl.mock.calls.map(([url]) => new URL(String(url)).pathname)).toEqual(['/health', '/api/status', '/api/animals'])
  })
  it('keeps backend online with unknown details after status failure', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json({ status: 'ok' })).mockRejectedValueOnce(new TypeError('Failed to fetch'))
    await expect(getSystemStatus({ mode: 'api', fetchImpl, now })).resolves.toEqual({ source: 'api', data: { backend: 'online', aiConfigured: null, version: null, storage: null, checkedAt: now } })
  })
})

describe('camera services', () => {
  const backendCamera = { id: 'camera-01', reported_status: 'online', status: 'online', last_report_at: now.toISOString(),
    last_online_at: now.toISOString(), last_error: null, frame_width: 640, frame_height: 352, fps: 11 }
  const live = { camera_id: 'camera-01', status: 'online', error: null, width: 640, height: 352, fps: 11, zone: [0.1, 0.1, 0.9, 0.9],
    captured_at: now.toISOString(), detections: [
      { class: 'cow', confidence: 0.9, bbox: [64, 35.2, 128, 70.4], inside_zone: false },
      { class: 'person', confidence: 0.8, bbox: [0, 0, 320, 176], inside_zone: null },
    ] }
  const aiServiceUrl = 'http://localhost:8090'

  it.each(['api', 'hybrid'] as const)('lists backend cameras in %s mode', async mode => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ items: [backendCamera], total: 1 }))
    await expect(listCameras({ mode, fetchImpl, now })).resolves.toEqual({
      source: 'api', data: [{ id: 'camera-01', name: 'Cámara 01', location: 'Cámara IP', status: 'online', lastSeenAt: now, lastError: null }],
    })
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringMatching(/\/api\/cameras$/), expect.objectContaining({ method: 'GET' }))
  })
  it('hides cameras that are not connected right now', async () => {
    const items = [backendCamera, { ...backendCamera, id: 'camera-02', status: 'offline' }, { ...backendCamera, id: 'camera-03', status: 'error' }]
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ items, total: 3 }))
    expect((await listCameras({ mode: 'api', fetchImpl, now })).data?.map(camera => camera.id)).toEqual(['camera-01'])
    fetchImpl.mockResolvedValue(Response.json({ items: items.slice(1), total: 2 }))
    expect((await listCameras({ mode: 'api', fetchImpl, now })).data).toEqual([])
  })
  it('streams the live camera as annotated MJPEG from the AI service', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json(live))
    await expect(getCameraStream('camera-01', { mode: 'hybrid', fetchImpl, now, aiServiceUrl })).resolves.toEqual({
      source: 'api', data: { kind: 'mjpeg', url: 'http://localhost:8090/video.mjpg', width: 640, height: 352, annotated: true },
    })
    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:8090/status', expect.anything())
  })
  it('never sends the session token to the AI service', async () => {
    tokenStore.set('jwt-123', 3600)
    try {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json(live))
      expect((await getCameraStream('camera-01', { mode: 'api', fetchImpl, now, aiServiceUrl })).data?.kind).toBe('mjpeg')
      expect(fetchImpl.mock.calls[0][1]?.headers).toBeUndefined()
    } finally {
      tokenStore.clear()
    }
  })
  it('uses the public stream URL the camera reported to the backend', async () => {
    const tunnel = 'https://abc-def.trycloudflare.com'
    const fetchImpl = vi.fn<typeof fetch>()
      .mockResolvedValueOnce(Response.json({ items: [{ ...backendCamera, stream_url: tunnel }], total: 1 }))
      .mockResolvedValueOnce(Response.json(live))
    expect((await getCameraStream('camera-01', { mode: 'api', fetchImpl, now })).data)
      .toEqual({ kind: 'mjpeg', url: `${tunnel}/video.mjpg`, width: 640, height: 352, annotated: true })
    expect(fetchImpl.mock.calls.map(([url]) => String(url))).toEqual([expect.stringMatching(/\/api\/cameras$/), `${tunnel}/status`])
  })
  it('reports no stream when the AI service is down, unset or serves another camera', async () => {
    const down = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))
    expect((await getCameraStream('camera-01', { mode: 'api', fetchImpl: down, now, aiServiceUrl })).data).toEqual({ kind: 'none' })
    const unset = vi.fn<typeof fetch>()
    expect((await getCameraStream('camera-01', { mode: 'api', fetchImpl: unset, now, aiServiceUrl: '' })).data).toEqual({ kind: 'none' })
    expect(unset).not.toHaveBeenCalled()
    const other = vi.fn<typeof fetch>().mockResolvedValue(Response.json(live))
    expect((await getCameraStream('camera-02', { mode: 'api', fetchImpl: other, now, aiServiceUrl })).data).toEqual({ kind: 'none' })
  })
  it('normalizes live detections', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json(live))
    const frame = (await getFrameDetections('camera-01', { mode: 'api', fetchImpl, now, aiServiceUrl })).data
    expect(frame?.capturedAt).toEqual(now)
    expect(frame?.detections).toEqual([
      { id: 'camera-01-0', label: 'cow', confidence: 0.9, insideSafeZone: false, box: { x: 0.1, y: 0.1, width: 0.1, height: 0.1 } },
      { id: 'camera-01-1', label: 'person', confidence: 0.8, insideSafeZone: null, box: { x: 0, y: 0, width: 0.5, height: 0.5 } },
    ])
  })
  it('returns no detections before the first live frame', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ...live, width: null, height: null, captured_at: null, detections: [] }))
    expect((await getFrameDetections('camera-01', { mode: 'api', fetchImpl, now, aiServiceUrl })).data).toBeNull()
  })
  it('keeps demo cameras, pictures and detections in mock mode', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const cameraId = mockCameras[0].id
    const cameras = await listCameras({ mode: 'mock', now, fetchImpl })
    expect(cameras.source).toBe('mock')
    expect(cameras.data).toHaveLength(4)
    expect(cameras.data?.every(camera => camera.lastSeenAt?.getTime() === now.getTime())).toBe(true)
    expect((await getFrameDetections(cameraId, { mode: 'mock', now, fetchImpl })).data).toEqual(buildMockFrameDetections(cameraId, now))
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('farm services', () => {
  const cameraId = mockCameras[0].id
  const farm = { id: 7, owner_id: 1, name: 'La Esperanza', location: 'Meta', area_hectares: 40, coordinates: null, lot_count: 2,
    created_at: now.toISOString(), updated_at: now.toISOString() }
  const lot = (id: number, name: string, area: number, camera: string | null) => ({
    id, farm_id: 7, name, kind: 'pasture', area_square_meters: area, length_meters: null, width_meters: null, capacity: 30,
    boundary: null, camera_id: camera, active: true, created_at: now.toISOString(), updated_at: now.toISOString(),
  })
  const camera = (id: string, status: string) => ({ id, reported_status: status, status, last_report_at: now.toISOString(),
    last_online_at: now.toISOString(), last_error: null, frame_width: 1280, frame_height: 720, fps: 12 })
  const route = (routes: Record<string, unknown>) => vi.fn<typeof fetch>().mockImplementation(async input => {
    const path = new URL(String(input)).pathname
    if (!(path in routes)) return new Response(null, { status: 404 })
    return Response.json(routes[path])
  })

  it.each(['mock'] as const)('keeps the demo farm in %s mode without fetching', async mode => {
    const fetchImpl = vi.fn<typeof fetch>()
    const options = { mode, now, fetchImpl }
    expect((await getDetectedCattleCount(options)).data?.count).toBe(mockDetectedCattle)
    expect((await getCurrentFarm(options)).data).toEqual(mockFarm)
    expect((await listSafeZones(cameraId, options)).data).toEqual(mockSafeZones.filter(zone => zone.cameraId === cameraId))
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('reads the first farm the backend lists', async () => {
    const fetchImpl = route({ '/api/farms': { items: [farm], total: 1 } })
    expect((await getCurrentFarm({ mode: 'api', fetchImpl, now })).data).toEqual({ id: '7', name: 'La Esperanza', location: 'Meta', areaHectares: 40 })
  })
  it('reports no farm until one is registered', async () => {
    const fetchImpl = route({ '/api/farms': { items: [], total: 0 }, '/api/cameras': { items: [], total: 0 } })
    expect((await getCurrentFarm({ mode: 'api', fetchImpl, now })).data).toBeNull()
    expect((await getFarmPlan({ mode: 'api', fetchImpl, now })).data).toBeNull()
  })
  it('draws one paddock per lot and one pole per camera, offline ones included', async () => {
    const fetchImpl = route({
      '/api/farms': { items: [farm], total: 1 },
      '/api/farms/7/lots': { items: [lot(1, 'Norte', 9000, 'camera-01'), lot(2, 'Sur', 12000, null)], total: 2 },
      '/api/cameras': { items: [camera('camera-01', 'online'), camera('camera-02', 'offline')], total: 2 },
    })
    const plan = (await getFarmPlan({ mode: 'api', fetchImpl, now })).data!
    expect(plan.lots.map(item => item.name)).toEqual(['Sur', 'Norte'])
    expect(plan.cameras).toEqual([
      expect.objectContaining({ cameraId: 'camera-01', lotId: 'lot-1' }),
      expect.objectContaining({ cameraId: 'camera-02', lotId: 'lot-2' }),
    ])
  })
  it('reads the active safe zones of a camera', async () => {
    const zone = { id: 3, camera_id: 'camera-01', name: 'Potrero', x_min: 0.1, y_min: 0.2, x_max: 0.9, y_max: 0.95, outline: null, active: true,
      created_at: now.toISOString() }
    const fetchImpl = route({ '/api/zones': { items: [zone, { ...zone, id: 4, active: false }], total: 2 } })
    expect((await listSafeZones('camera-01', { mode: 'api', fetchImpl, now })).data)
      .toEqual([{ id: '3', cameraId: 'camera-01', name: 'Potrero', bounds: [0.1, 0.2, 0.9, 0.95], outline: undefined }])
    expect(String(fetchImpl.mock.calls[0][0])).toContain('camera_id=camera-01')
  })
  it('counts the herd from the live metrics, and nothing before any camera reported', async () => {
    const metrics = { cameras_total: 2, cameras_online: 2, stale_cameras: 0, cattle_inside: 11, cattle_outside: 1, cattle_total: 12,
      open_alerts: 1, events_last_hour: 3, system_status: 'operational', generated_at: now.toISOString() }
    expect((await getDetectedCattleCount({ mode: 'api', fetchImpl: route({ '/api/metrics/live': metrics }), now })).data)
      .toEqual({ count: 12, countedAt: now })
    expect((await getDetectedCattleCount({ mode: 'api', fetchImpl: route({ '/api/metrics/live': { ...metrics, cameras_total: 0, cameras_online: 0, cattle_inside: 0, cattle_outside: 0, cattle_total: 0 } }), now })).data)
      .toBeNull()
  })
})

describe('alert services', () => {
  const alert = { id: 'a1', event_id: 'e1', camera_id: 'camera-01', alert_type: 'cattle_out_of_zone', severity: 'high', status: 'open',
    message: 'Cow out of zone', created_at: now.toISOString(), acknowledged_at: null, acknowledged_by: null, resolved_at: null, resolved_by: null }

  it('lists alerts with backend filters and maps the severity', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ items: [alert], total: 1 }))
    const result = await listAlerts({ status: 'open', severity: 'critical' }, { mode: 'api', fetchImpl, now })
    expect(result.data[0]).toMatchObject({ id: 'a1', kind: 'cattle_out_of_zone', severity: 'critical', status: 'open' })
    expect(String(fetchImpl.mock.calls[0][0])).toMatch(/status=open&severity=high/)
  })
  it('acknowledges through the backend', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ...alert, status: 'acknowledged', acknowledged_at: now.toISOString() }))
    expect((await acknowledgeAlert('a1', { mode: 'api', fetchImpl, now })).status).toBe('acknowledged')
    expect(fetchImpl).toHaveBeenCalledWith(expect.stringMatching(/\/api\/alerts\/a1\/acknowledge$/), expect.objectContaining({ method: 'POST' }))
  })
  it('moves demo alerts through their states in mock mode', async () => {
    const [open] = (await listAlerts({ status: 'open' }, { mode: 'mock', now })).data
    expect((await resolveAlert(open.id, { mode: 'mock', now })).status).toBe('resolved')
    expect((await listAlerts({ status: 'open' }, { mode: 'mock', now })).data.map(item => item.id)).not.toContain(open.id)
  })
})

describe('central mock data', () => {
  it('uses null detection data only for system events', () => {
    const systemEvents = events.filter(event => event.kind === 'camera_disconnected' || event.kind === 'ai_unavailable')
    expect(systemEvents).toHaveLength(3)
    for (const event of systemEvents) {
      expect(event.detectedObject).toBeNull()
      expect(event.confidence).toBeNull()
    }
    for (const event of events.filter(event => !systemEvents.includes(event))) {
      expect(typeof event.detectedObject).toBe('string')
      expect(typeof event.confidence).toBe('number')
    }
  })
  it('provides distinct camera zones with Spanish names', () => {
    expect(mockSafeZones.filter(zone => !zone.outline).map(({ cameraId, name, bounds }) => ({ cameraId, name, bounds }))).toEqual([
      { cameraId: 'main-entrance', name: 'Zona segura acceso', bounds: [0.18, 0.30, 0.86, 0.96] },
      { cameraId: 'corral', name: 'Corral', bounds: [0.06, 0.10, 0.94, 0.92] },
      { cameraId: 'north-pasture', name: 'Lote 3', bounds: [0.04, 0.22, 0.88, 0.97] },
    ])
    const south = mockSafeZones.find(zone => zone.cameraId === 'south-pasture')!
    expect(south.name).toBe('Lote 5')
    expect(south.outline).toHaveLength(4)
    // Bounds are the bounding box of the outline.
    expect(south.bounds[0]).toBeCloseTo(Math.min(...south.outline!.map(([x]) => x)))
    expect(south.bounds[3]).toBeCloseTo(Math.max(...south.outline!.map(([, y]) => y)))
  })
  it('provides backend-capable mock services without fetching', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const options = { mode: 'mock' as const, now, fetchImpl }
    await expect(listEvents(options)).resolves.toEqual({ data: events, source: 'mock' })
    await expect(getRegisteredCattleCount(options)).resolves.toEqual({ data: mockRegisteredCattle, source: 'mock' })
    expect((await getSystemStatus(options)).data).toMatchObject({ backend: 'not-checked', aiConfigured: null, version: null, storage: null, checkedAt: now })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
  it('covers all event kinds in the last 48 hours, newest first', () => {
    expect(events).toHaveLength(12)
    expect(new Set(events.map(event => event.kind))).toEqual(new Set(Object.keys(eventCatalog)))
    const times = events.map(event => event.occurredAt.getTime())
    expect(times).toEqual([...times].sort((a, b) => b - a))
    expect(times.every(time => time <= now.getTime() && time >= now.getTime() - 48 * 3_600_000)).toBe(true)
    const intrusion = events.find(event => event.kind === 'possible_intrusion')!
    expect(intrusion).toMatchObject({ cameraId: 'north-pasture', severity: 'critical', severitySource: 'backend' })
    expect(intrusion.occurredAt.getDate()).toBe(now.getDate() - 1)
    expect([intrusion.occurredAt.getHours(), intrusion.occurredAt.getMinutes()]).toEqual([2, 14])
    const person = events.find(event => event.kind === 'person_detected')!
    expect(person.severity).toBe('info')
    expect(person.occurredAt.getHours()).toBe(14)
  })
  it('builds deterministic detections with valid geometry and zone membership', () => {
    // The south pasture uses hand-placed boxes over the demo photo; it is tested separately below.
    for (const camera of mockCameras.filter(item => item.id !== 'south-pasture')) {
      const frame = buildMockFrameDetections(camera.id, now)
      expect(frame).toEqual(buildMockFrameDetections(camera.id, now))
      expect(frame.detections).toEqual(buildMockFrameDetections(camera.id, new Date(now.getTime() + 1000)).detections)
      const cows = camera.id === 'corral' ? 9 : camera.id === 'north-pasture' ? 6 : 4
      expect(frame.detections.map(item => item.label)).toEqual([
        ...Array<string>(cows).fill('cow'), ...(camera.id === 'north-pasture' ? ['person'] : []),
      ])
      expect(new Set(frame.detections.map(item => item.box.x)).size).toBe(frame.detections.length)
      expect(new Set(frame.detections.map(item => item.box.y)).size).toBe(frame.detections.length)
      expect(new Set(frame.detections.map(item => item.box.width)).size).toBe(frame.detections.length)
      const a = frame.detections[1].box
      const b = frame.detections[2].box
      expect(Math.min(a.x + a.width, b.x + b.width) - Math.max(a.x, b.x)).toBeGreaterThan(0)
      expect(Math.min(a.y + a.height, b.y + b.height) - Math.max(a.y, b.y)).toBeGreaterThan(0)
      const zone = mockSafeZones.find(item => item.cameraId === camera.id)!
      for (const detection of frame.detections) {
        expect(detection.confidence).toBeGreaterThanOrEqual(0.71)
        expect(detection.confidence).toBeLessThanOrEqual(0.97)
        expect(detection.insideSafeZone).toBe(isWithinBounds(detection.box, zone.bounds))
        expect(detection.box.x).toBeGreaterThanOrEqual(0)
        expect(detection.box.y).toBeGreaterThanOrEqual(0)
        expect(detection.box.width).toBeGreaterThanOrEqual(0.07)
        expect(detection.box.width).toBeLessThanOrEqual(0.14)
        expect(detection.box.height).toBeCloseTo(detection.box.width * 16 / 9 * 0.55)
        expect(detection.box.x + detection.box.width).toBeLessThanOrEqual(1)
        expect(detection.box.y + detection.box.height).toBeLessThanOrEqual(1)
      }
      expect(frame.detections.filter(item => !item.insideSafeZone)).toHaveLength(0)
    }
    const south = buildMockFrameDetections('south-pasture', now)
    expect(south.detections).toHaveLength(6)
    expect(south.detections.every(item => item.label === 'cow')).toBe(true)
    const outside = south.detections.filter(item => !item.insideSafeZone)
    expect(outside.map(item => item.id)).toEqual(['south-pasture-detection-6'])
    expect(buildMockFrameDetections('corral', now).detections).toHaveLength(9)
    expect(buildMockFrameDetections('north-pasture', now).detections).toHaveLength(7)
    expect(buildMockFrameDetections('south-pasture', now).detections.filter(item => !item.insideSafeZone)).toHaveLength(1)
  })
})
