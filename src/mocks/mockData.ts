// DEVELOPMENT MOCK DATA. Not backend data. Replace with real API responses when the backend supports them.
import type { Camera, EventKind, Farm, FarmEvent, FrameDetections, SafeZone, SystemStatus } from '../types/domain'
import { eventCatalog } from '../lib/eventCatalog'
import { isInsideZone, isWithinBounds } from '../services/mappers'
import { demoFeedBoxes, demoFeedCameraId, demoFeedZoneOutline } from './mockCameraFeed'

export const mockFarm: Farm = { id: 'farm-san-jose', name: 'San José' }
export const mockRegisteredCattle = 144
export const mockDetectedCattle = 143
export const mockCameras: Camera[] = [
  { id: 'main-entrance', name: 'Entrada principal', location: 'Acceso vehicular', status: 'online', lastSeenAt: new Date() },
  { id: 'corral', name: 'Corral', location: 'Corral central', status: 'online', lastSeenAt: new Date() },
  { id: 'north-pasture', name: 'Potrero Norte', location: 'Lote 3', status: 'online', lastSeenAt: new Date() },
  { id: 'south-pasture', name: 'Potrero Sur', location: 'Lote 5', status: 'online', lastSeenAt: new Date() },
]
export const mockSafeZones: SafeZone[] = [
  { id: 'main-entrance-safe-zone', cameraId: 'main-entrance', name: 'Zona segura acceso', bounds: [0.18, 0.30, 0.86, 0.96] },
  { id: 'corral-safe-zone', cameraId: 'corral', name: 'Corral', bounds: [0.06, 0.10, 0.94, 0.92] },
  { id: 'north-pasture-safe-zone', cameraId: 'north-pasture', name: 'Lote 3', bounds: [0.04, 0.22, 0.88, 0.97] },
  {
    id: 'south-pasture-safe-zone', cameraId: 'south-pasture', name: 'Lote 5', outline: demoFeedZoneOutline,
    bounds: [
      Math.min(...demoFeedZoneOutline.map(([x]) => x)), Math.min(...demoFeedZoneOutline.map(([, y]) => y)),
      Math.max(...demoFeedZoneOutline.map(([x]) => x)), Math.max(...demoFeedZoneOutline.map(([, y]) => y)),
    ],
  },
]

function seededRandom(cameraId: string) {
  let seed = 2166136261
  for (const character of cameraId) seed = Math.imul(seed ^ character.charCodeAt(0), 16777619)
  return () => {
    seed = (seed + 0x6D2B79F5) | 0
    let value = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

export function buildMockSystemStatus(now = new Date()): SystemStatus {
  return { backend: 'online', aiConfigured: true, version: '0.0.0-mock', storage: 'memory', checkedAt: new Date(now) }
}

export function buildMockFrameDetections(cameraId: string, now = new Date()): FrameDetections {
  const zone = mockSafeZones.find(item => item.cameraId === cameraId)
  if (!zone) return { cameraId, capturedAt: new Date(now), detections: [] }
  // The demo photo camera uses boxes placed over the real animals in the picture.
  if (cameraId === demoFeedCameraId) return {
    cameraId, capturedAt: new Date(now),
    detections: demoFeedBoxes.map((item, index) => ({
      id: `${cameraId}-detection-${index + 1}`, label: item.label, confidence: item.confidence,
      box: item.box, insideSafeZone: isInsideZone(item.box, zone),
    })),
  }
  const cowCount = cameraId === 'corral' ? 9 : cameraId === 'north-pasture' ? 6 : 4
  const count = cowCount + (cameraId === 'north-pasture' ? 1 : 0)
  const random = seededRandom(cameraId)
  const [left, top, right, bottom] = zone.bounds
  // A shared herd center keeps a few animals close enough to overlap.
  const herdX = left + (right - left) * (0.3 + random() * 0.3)
  const herdY = top + (bottom - top) * (0.3 + random() * 0.3)
  return {
    cameraId, capturedAt: new Date(now),
    detections: Array.from({ length: count }, (_, index) => {
      const width = 0.07 + random() * 0.07
      const height = width * 16 / 9 * 0.55
      const clustered = index === 1 || index === 2
      const x = clustered ? herdX + random() * 0.035 : left + random() * (right - left - width)
      const y = clustered ? herdY + random() * 0.035 : top + random() * (bottom - top - height)
      const box = { x, y, width, height }
      return {
        id: `${cameraId}-detection-${index + 1}`, label: index < cowCount ? 'cow' : 'person',
        confidence: Number((0.71 + ((index * 7) % 27) / 100).toFixed(2)),
        box, insideSafeZone: isWithinBounds(box, zone.bounds),
      }
    }),
  }
}

export function buildMockFarmEvents(now = new Date()): FarmEvent[] {
  const night = new Date(now)
  night.setDate(night.getDate() - 1)
  night.setHours(2, 14, 0, 0)
  const daytime = new Date(now)
  daytime.setDate(daytime.getDate() - 1)
  daytime.setHours(14, 0, 0, 0)
  const templates: { kind: EventKind; cameraId: string; detectedObject: string | null; hoursAgo?: number; at?: Date }[] = [
    { kind: 'cattle_out_of_zone', cameraId: 'south-pasture', detectedObject: 'cow', hoursAgo: 0.25 },
    { kind: 'person_detected', cameraId: 'main-entrance', detectedObject: 'person', at: daytime },
    { kind: 'possible_intrusion', cameraId: 'north-pasture', detectedObject: 'person', at: night },
    { kind: 'external_animal_detected', cameraId: 'north-pasture', detectedObject: 'cow', hoursAgo: 3 },
    { kind: 'possible_unauthorized_movement', cameraId: 'main-entrance', detectedObject: 'vehicle', hoursAgo: 5 },
    { kind: 'camera_disconnected', cameraId: 'corral', detectedObject: null, hoursAgo: 8 },
    { kind: 'ai_unavailable', cameraId: 'corral', detectedObject: null, hoursAgo: 10 },
    { kind: 'cattle_out_of_zone', cameraId: 'corral', detectedObject: 'cow', hoursAgo: 16 },
    { kind: 'external_animal_detected', cameraId: 'south-pasture', detectedObject: 'cow', hoursAgo: 23 },
    { kind: 'cattle_out_of_zone', cameraId: 'north-pasture', detectedObject: 'cow', hoursAgo: 30 },
    { kind: 'camera_disconnected', cameraId: 'main-entrance', detectedObject: null, hoursAgo: 38 },
    { kind: 'cattle_out_of_zone', cameraId: 'south-pasture', detectedObject: 'cow', hoursAgo: 47 },
  ]
  return templates.map((template, index): FarmEvent => {
    const occurredAt = template.at ?? new Date(now.getTime() - template.hoursAgo! * 3_600_000)
    return {
      id: `mock-event-${index + 1}`, kind: template.kind, cameraId: template.cameraId,
      detectedObject: template.detectedObject,
      confidence: template.detectedObject === null ? null : Number((0.71 + (index % 9) * 0.03).toFixed(2)),
      occurredAt, receivedAt: new Date(occurredAt.getTime() + 1000),
      severity: eventCatalog[template.kind].defaultSeverity,
      // Simulate a future backend rule that assigns severity based on nighttime activity.
      severitySource: template.kind === 'possible_intrusion' ? 'backend' : 'catalog',
    }
  }).sort((a, b) => b.occurredAt.getTime() - a.occurredAt.getTime())
}
