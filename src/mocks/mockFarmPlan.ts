// DEVELOPMENT MOCK DATA. Not backend data. The backend has no farm geometry or security hours yet;
// this schematic plan and these hours are illustrative and must be replaced by real data.

/** Plan coordinates use a 800 x 520 schematic space. */
export interface PlanPoint { x: number; y: number }

export interface PlanLot {
  id: string
  name: string
  /** Lindero (boundary) vertices, clockwise. */
  boundary: readonly PlanPoint[]
  labelAt: PlanPoint
}

export interface PlanCamera {
  cameraId: string
  lotId: string
  position: PlanPoint
  /** Direction the camera faces, in degrees (0 = east, 90 = south). */
  heading: number
  /** Draw the name on the left of the point (for points near the right edge). */
  labelLeft?: boolean
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

export const mockFarmPlan: FarmPlan = {
  width: 800,
  height: 520,
  lots: [
    { id: 'lot-access', name: 'Acceso', labelAt: { x: 64, y: 456 },
      boundary: [{ x: 40, y: 372 }, { x: 214, y: 360 }, { x: 226, y: 474 }, { x: 52, y: 486 }] },
    { id: 'lot-corral', name: 'Corral', labelAt: { x: 172, y: 316 },
      boundary: [{ x: 150, y: 196 }, { x: 292, y: 186 }, { x: 304, y: 326 }, { x: 160, y: 334 }] },
    { id: 'lot-3', name: 'Lote 3', labelAt: { x: 372, y: 216 },
      boundary: [{ x: 352, y: 36 }, { x: 762, y: 58 }, { x: 744, y: 236 }, { x: 362, y: 228 }] },
    { id: 'lot-5', name: 'Lote 5', labelAt: { x: 360, y: 458 },
      boundary: [{ x: 362, y: 272 }, { x: 744, y: 282 }, { x: 726, y: 482 }, { x: 340, y: 472 }] },
  ],
  cameras: [
    { cameraId: 'main-entrance', lotId: 'lot-access', position: { x: 196, y: 380 }, heading: 200 },
    { cameraId: 'corral', lotId: 'lot-corral', position: { x: 284, y: 202 }, heading: 140 },
    { cameraId: 'north-pasture', lotId: 'lot-3', position: { x: 372, y: 56 }, heading: 25 },
    { cameraId: 'south-pasture', lotId: 'lot-5', position: { x: 728, y: 298 }, heading: 155, labelLeft: true },
  ],
  track: [{ x: 0, y: 432 }, { x: 236, y: 420 }, { x: 322, y: 300 }, { x: 330, y: 254 }, { x: 800, y: 260 }],
  contours: [
    'M 0 120 C 120 90, 220 150, 330 110 S 560 60, 800 20',
    'M 0 170 C 140 140, 230 200, 340 160 S 600 120, 800 90',
    'M 420 520 C 470 430, 600 400, 800 410',
    'M 0 300 C 60 290, 100 340, 140 360',
  ],
}

/** Restricted hours for security events (local time, wraps past midnight). */
export const mockSecurityHours = { restrictedFrom: 19, restrictedTo: 5 }
