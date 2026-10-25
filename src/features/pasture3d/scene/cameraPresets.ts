import { polygonInteriorPoint } from '../simulation/geometry'
import type { SimulationLot } from '../simulation/herdSimulation'

export const OVERVIEW_PRESET_ID = 'overview'

export interface CameraPreset {
  id: string
  label: string
  position: [number, number, number]
  target: [number, number, number]
}

export function buildCameraPresets(lots: readonly SimulationLot[]): CameraPreset[] {
  const overview: CameraPreset = {
    id: OVERVIEW_PRESET_ID,
    label: 'Vista general',
    position: [0, 54, 64],
    target: [0, 0, 0],
  }

  return [overview, ...lots.map((lot): CameraPreset => {
    const xs = lot.boundary.map(point => point.x)
    const zs = lot.boundary.map(point => point.z)
    const extent = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...zs) - Math.min(...zs))
    const center = polygonInteriorPoint(lot.boundary)
    const distance = extent * 0.95 + 8
    return {
      id: lot.id,
      label: lot.name,
      position: [center.x - distance * 0.18, distance * 0.62, center.z + distance * 0.82],
      target: [center.x, 0, center.z],
    }
  })]
}
