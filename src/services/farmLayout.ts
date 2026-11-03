import type { Camera, Lot } from '../types/domain'

// The farm drawing used by the dashboard plan and the 3D pasture. The backend describes lots by name,
// size and camera, not by geometry, so each real lot is placed on a slot of this drawing.

/** Plan coordinates use a 800 x 520 schematic space. */
export interface PlanPoint { x: number; y: number }

export interface PlanLot {
  id: string
  name: string
  /** Lindero (boundary) vertices, clockwise from the top-left corner. */
  boundary: readonly PlanPoint[]
  labelAt: PlanPoint
  /** Head capacity from the backend, when known. */
  capacity?: number | null
}

export interface PlanCamera {
  cameraId: string
  lotId: string
  position: PlanPoint
  /** Direction the camera faces, in degrees (0 = east, 90 = south). */
  heading: number
  /** Where the camera name sits relative to the point, chosen so it never crosses a lindero. */
  label: { side: 'left' | 'right'; dy: number }
}

export interface FarmPlan {
  width: number
  height: number
  lots: readonly PlanLot[]
  cameras: readonly PlanCamera[]
  /** Farm track drawn as a polyline. */
  track: readonly PlanPoint[]
  /** Terrain contour lines as SVG path data. */
  contours: readonly string[]
}

interface Slot {
  boundary: readonly PlanPoint[]
  labelAt: PlanPoint
  camera?: Pick<PlanCamera, 'position' | 'heading' | 'label'>
}

const WIDTH = 800
const HEIGHT = 520

/** The four paddocks of the approved drawing, largest first once sorted by area. */
const designedSlots: readonly Slot[] = [
  { labelAt: { x: 64, y: 456 },
    boundary: [{ x: 40, y: 372 }, { x: 214, y: 360 }, { x: 226, y: 474 }, { x: 52, y: 486 }],
    camera: { position: { x: 196, y: 380 }, heading: 200, label: { side: 'left', dy: 4 } } },
  { labelAt: { x: 172, y: 316 },
    boundary: [{ x: 150, y: 196 }, { x: 292, y: 186 }, { x: 304, y: 326 }, { x: 160, y: 334 }],
    camera: { position: { x: 284, y: 202 }, heading: 140, label: { side: 'left', dy: 4 } } },
  { labelAt: { x: 372, y: 216 },
    boundary: [{ x: 352, y: 36 }, { x: 762, y: 58 }, { x: 744, y: 236 }, { x: 362, y: 228 }],
    camera: { position: { x: 372, y: 56 }, heading: 25, label: { side: 'right', dy: 24 } } },
  { labelAt: { x: 360, y: 458 },
    boundary: [{ x: 362, y: 272 }, { x: 744, y: 282 }, { x: 726, y: 482 }, { x: 340, y: 472 }],
    camera: { position: { x: 728, y: 298 }, heading: 155, label: { side: 'left', dy: 26 } } },
]

const track: readonly PlanPoint[] = [{ x: 0, y: 432 }, { x: 236, y: 420 }, { x: 322, y: 300 }, { x: 330, y: 254 }, { x: 800, y: 260 }]
const contours: readonly string[] = [
  'M 0 120 C 120 90, 220 150, 330 110 S 560 60, 800 20',
  'M 0 170 C 140 140, 230 200, 340 160 S 600 120, 800 90',
  'M 420 520 C 470 430, 600 400, 800 410',
  'M 0 300 C 60 290, 100 340, 140 360',
]

export function polygonArea(points: readonly PlanPoint[]): number {
  let sum = 0
  for (let i = 0, j = points.length - 1; i < points.length; j = i++) sum += points[j].x * points[i].y - points[i].x * points[j].y
  return Math.abs(sum) / 2
}

function centroid(points: readonly PlanPoint[]): PlanPoint {
  return {
    x: points.reduce((sum, point) => sum + point.x, 0) / points.length,
    y: points.reduce((sum, point) => sum + point.y, 0) / points.length,
  }
}

/** Splits a band north or south of the track into `count` paddocks with a narrow lane between them. */
function bandSlots(count: number, top: number, bottom: number, left = 352, right = 762): Slot[] {
  const gap = 14
  const width = (right - left - gap * (count - 1)) / count
  return Array.from({ length: count }, (_, index) => {
    const x0 = left + index * (width + gap)
    const x1 = x0 + width
    // A slight skew keeps generated paddocks from reading as a spreadsheet grid.
    const skew = index % 2 === 0 ? 6 : -6
    return {
      boundary: [{ x: x0, y: top + skew }, { x: x1, y: top - skew }, { x: x1 - 4, y: bottom }, { x: x0 + 4, y: bottom }],
      labelAt: { x: x0 + 14, y: bottom - 14 },
    }
  })
}

/** Paddock slots for `count` lots: the designed drawing up to four, then the east side is subdivided. */
export function layoutSlots(count: number): Slot[] {
  if (count <= designedSlots.length) {
    return [...designedSlots].sort((a, b) => polygonArea(b.boundary) - polygonArea(a.boundary)).slice(0, count)
  }
  const east = count - 2
  const north = Math.ceil(east / 2)
  return [
    ...bandSlots(north, 40, 232),
    ...bandSlots(east - north, 282, 478),
    designedSlots[1],
    designedSlots[0],
  ]
}

function cornerCamera(slot: Slot, index: number): Pick<PlanCamera, 'position' | 'heading' | 'label'> {
  const corner = slot.boundary[index % slot.boundary.length]
  const center = centroid(slot.boundary)
  // Just inside the corner, looking across the lot.
  const position = { x: corner.x + (center.x - corner.x) * 0.08, y: corner.y + (center.y - corner.y) * 0.08 }
  const heading = Math.atan2(center.y - position.y, center.x - position.x) * 180 / Math.PI
  return { position, heading, label: { side: position.x > center.x ? 'left' : 'right', dy: position.y < center.y ? 24 : 4 } }
}

/**
 * The plan for the real farm: one paddock per active lot (largest lots on the largest slots) and one
 * pole per camera. A camera with no lot is placed on the lots that have none, so every camera shows.
 */
export function buildFarmPlan(lots: readonly Lot[], cameras: readonly Pick<Camera, 'id'>[]): FarmPlan | null {
  let active = lots.filter(lot => lot.active)
  // Cameras without any lot registered still deserve a place on the plan: one area per camera.
  if (active.length === 0) {
    active = cameras.map((camera): Lot => ({
      id: `camera-area-${camera.id}`, name: `Zona ${camera.id}`, kind: 'paddock', areaSquareMeters: null, capacity: null,
      cameraId: camera.id, active: true,
    }))
  }
  if (active.length === 0) return null

  const ordered = [...active].sort((a, b) => (b.areaSquareMeters ?? 0) - (a.areaSquareMeters ?? 0))
  const slots = layoutSlots(ordered.length)
  const planLots: PlanLot[] = ordered.map((lot, index) => ({
    id: lot.id, name: lot.name, boundary: slots[index].boundary, labelAt: slots[index].labelAt, capacity: lot.capacity,
  }))

  const camerasPerLot = new Map<string, number>()
  const lotForCamera = (cameraId: string, fallbackIndex: number): number => {
    const owned = ordered.findIndex(lot => lot.cameraId === cameraId)
    if (owned >= 0) return owned
    const free = ordered.findIndex(lot => !lot.cameraId && !camerasPerLot.has(lot.id))
    return free >= 0 ? free : fallbackIndex % ordered.length
  }

  const planCameras = cameras.map((camera, index): PlanCamera => {
    const lotIndex = lotForCamera(camera.id, index)
    const lot = ordered[lotIndex]
    const seen = camerasPerLot.get(lot.id) ?? 0
    camerasPerLot.set(lot.id, seen + 1)
    const slot = slots[lotIndex]
    const placement = seen === 0 && slot.camera ? slot.camera : cornerCamera(slot, seen + 1)
    return { cameraId: camera.id, lotId: lot.id, ...placement }
  })

  return { width: WIDTH, height: HEIGHT, lots: planLots, cameras: planCameras, track, contours }
}
