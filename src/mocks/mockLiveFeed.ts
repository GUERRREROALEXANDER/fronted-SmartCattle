// DEMO ONLY (VITE_DATA_SOURCE=mock). Plays the AI service: it pushes the same /ws/live messages the
// backend sends, so the dashboard and the 3D pasture run exactly the code path they run in production.
import type { LiveMessage } from '../live/messages'
import { isInsideZone } from '../services/mappers'
import type { Alert, Detection, NormalizedBox, SafeZone } from '../types/domain'
import { mockCameras, mockSafeZones } from './mockData'

interface Walker {
  trackId: number
  label: 'cow' | 'person'
  x: number
  y: number
  tx: number
  ty: number
  speed: number
  rest: number
  /** Heading out of the safe zone on purpose (the demo's "escape"). */
  leaving: number
  inside: boolean
}

interface CameraHerd {
  cameraId: string
  zone: SafeZone
  walkers: Walker[]
  nextTrack: number
  lastCount: string
}

const TICK_MS = 500
const COWS: Record<string, number> = { 'main-entrance': 3, corral: 7, 'north-pasture': 6, 'south-pasture': 5 }

function rng(seed: number) {
  let state = seed
  return () => {
    state = (state + 0x6D2B79F5) | 0
    let value = Math.imul(state ^ (state >>> 15), 1 | state)
    value ^= value + Math.imul(value ^ (value >>> 7), 61 | value)
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296
  }
}

function boxOf(walker: Walker): NormalizedBox {
  const width = walker.label === 'cow' ? 0.085 : 0.035
  const height = walker.label === 'cow' ? 0.07 : 0.12
  // The anchor is the feet: bottom-center of the box.
  return { x: walker.x - width / 2, y: walker.y - height, width, height }
}

/** Starts the demo feed; returns a function that stops it. */
export function startMockLiveFeed(emit: (message: LiveMessage) => void, seed = 2026): () => void {
  const random = rng(seed)
  const between = (min: number, max: number) => min + random() * (max - min)
  const herds: CameraHerd[] = mockCameras.map(camera => {
    const zone = mockSafeZones.find(item => item.cameraId === camera.id)!
    const [left, top, right, bottom] = zone.bounds
    const walkers = Array.from({ length: COWS[camera.id] ?? 4 }, (_, index): Walker => {
      const x = between(left + 0.06, right - 0.06)
      const y = between(top + 0.12, bottom - 0.04)
      return { trackId: index + 1, label: 'cow', x, y, tx: x, ty: y, speed: between(0.008, 0.016), rest: between(0, 6), leaving: 0, inside: true }
    })
    return { cameraId: camera.id, zone, walkers, nextTrack: walkers.length + 1, lastCount: '' }
  })
  let elapsed = 0
  let nextEscape = 18
  let nextVisitor = 8
  let alertSerial = 0

  const pickTarget = (herd: CameraHerd, walker: Walker) => {
    const [left, top, right, bottom] = herd.zone.bounds
    walker.tx = between(left + 0.06, right - 0.06)
    walker.ty = between(top + 0.12, bottom - 0.04)
  }

  const raiseAlert = (herd: CameraHerd, walker: Walker, at: Date) => {
    alertSerial += 1
    const person = walker.label === 'person'
    const alert: Alert = {
      id: `demo-live-alert-${alertSerial}`, eventId: null, cameraId: herd.cameraId,
      kind: person ? 'person_detected' : 'cattle_out_of_zone',
      message: person ? 'Persona detectada en el acceso' : `Vaca #${walker.trackId} fuera de la zona segura`,
      severity: person ? 'warning' : 'critical', status: 'open', createdAt: at, acknowledgedAt: null, resolvedAt: null,
    }
    emit({ type: 'alert.created', alert })
    emit({
      type: 'event.created',
      event: {
        id: `demo-live-event-${alertSerial}`, kind: alert.kind!, cameraId: herd.cameraId, detectedObject: walker.label,
        confidence: Number(between(0.82, 0.97).toFixed(2)), occurredAt: at, receivedAt: at, severity: alert.severity, severitySource: 'backend',
      },
    })
  }

  const tick = () => {
    const dt = TICK_MS / 1000
    elapsed += dt
    const at = new Date()

    if (elapsed >= nextEscape) {
      // One cow walks out of its paddock now and then, the way the real alert is raised.
      const herd = herds[Math.floor(random() * herds.length)]
      const calm = herd.walkers.filter(walker => walker.label === 'cow' && walker.inside && walker.leaving === 0)
      const cow = calm[Math.floor(random() * calm.length)]
      if (cow) {
        const [left, , right, bottom] = herd.zone.bounds
        cow.leaving = 16
        cow.tx = cow.x < (left + right) / 2 ? Math.max(0.02, left - 0.07) : Math.min(0.98, right + 0.07)
        cow.ty = Math.min(0.98, bottom - 0.05)
        cow.speed = 0.03
      }
      nextEscape = elapsed + between(32, 55)
    }
    if (elapsed >= nextVisitor) {
      const herd = herds.find(item => item.cameraId === 'main-entrance') ?? herds[0]
      if (!herd.walkers.some(walker => walker.label === 'person')) {
        const fromLeft = random() < 0.5
        const visitor: Walker = {
          trackId: herd.nextTrack++, label: 'person', x: fromLeft ? 0.03 : 0.97, y: between(0.55, 0.8),
          tx: fromLeft ? 0.97 : 0.03, ty: between(0.55, 0.85), speed: 0.03, rest: 0, leaving: 0, inside: true,
        }
        herd.walkers.push(visitor)
        raiseAlert(herd, visitor, at)
      }
      nextVisitor = elapsed + between(35, 60)
    }

    for (const herd of herds) {
      for (const walker of herd.walkers) {
        if (walker.rest > 0) {
          walker.rest -= dt
          continue
        }
        const dx = walker.tx - walker.x
        const dy = walker.ty - walker.y
        const distance = Math.hypot(dx, dy)
        const step = walker.speed * dt
        if (distance <= step) {
          walker.x = walker.tx
          walker.y = walker.ty
          if (walker.label === 'person') walker.rest = Infinity
          else if (walker.leaving > 0) walker.rest = 1
          else {
            walker.rest = between(2, 9)
            pickTarget(herd, walker)
          }
        } else {
          walker.x += (dx / distance) * step
          walker.y += (dy / distance) * step
        }
        if (walker.leaving > 0) {
          walker.leaving -= dt
          if (walker.leaving <= 0) {
            // Herded back in.
            walker.speed = between(0.012, 0.02)
            walker.rest = 0
            pickTarget(herd, walker)
          }
        }
        const inside = isInsideZone(boxOf(walker), herd.zone)
        if (walker.label === 'cow' && walker.inside && !inside) raiseAlert(herd, walker, at)
        walker.inside = inside
      }
      // A visitor who crossed the frame leaves the picture.
      herd.walkers = herd.walkers.filter(walker => !(walker.label === 'person' && walker.rest === Infinity))

      const detections: Detection[] = herd.walkers.map(walker => ({
        id: `${herd.cameraId}#${walker.trackId}`, trackId: walker.trackId, label: walker.label,
        confidence: walker.label === 'cow' ? 0.9 : 0.86, box: boxOf(walker), insideSafeZone: walker.inside,
      }))
      emit({ type: 'detections', frame: { cameraId: herd.cameraId, capturedAt: at, detections } })

      const cows = herd.walkers.filter(walker => walker.label === 'cow')
      const outside = cows.filter(walker => !walker.inside).length
      const count = `${cows.length - outside}/${outside}`
      if (count !== herd.lastCount) {
        herd.lastCount = count
        emit({ type: 'occupancy.updated', occupancy: { cameraId: herd.cameraId, inside: cows.length - outside, outside, observedAt: at } })
      }
    }
  }

  emit({ type: 'hello', role: 'owner' })
  tick()
  const timer = setInterval(tick, TICK_MS)
  return () => clearInterval(timer)
}
