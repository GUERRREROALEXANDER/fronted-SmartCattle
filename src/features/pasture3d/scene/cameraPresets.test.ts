import { describe, expect, it } from 'vitest'
import type { SimulationLot } from '../simulation/herdSimulation'
import { buildCameraPresets, OVERVIEW_PRESET_ID } from './cameraPresets'

const square = (id: string, name: string, cx: number, cz: number, half: number): SimulationLot => ({
  id,
  name,
  boundary: [
    { x: cx - half, z: cz - half },
    { x: cx + half, z: cz - half },
    { x: cx + half, z: cz + half },
    { x: cx - half, z: cz + half },
  ],
} as SimulationLot)

describe('buildCameraPresets', () => {
  it('always offers the overview first', () => {
    // It is the view the page opens on, so it has to exist even with no lots
    // configured -- otherwise the scene starts with no camera at all.
    const presets = buildCameraPresets([])
    expect(presets).toHaveLength(1)
    expect(presets[0].id).toBe(OVERVIEW_PRESET_ID)
  })

  it('adds one preset per lot, in order', () => {
    const presets = buildCameraPresets([
      square('lot-a', 'Potrero A', 0, 0, 10),
      square('lot-b', 'Potrero B', 40, 0, 10),
    ])
    expect(presets.map(preset => preset.id)).toEqual([OVERVIEW_PRESET_ID, 'lot-a', 'lot-b'])
  })

  it('names each preset after its lot', () => {
    // The preset list is a menu the user reads, so the label has to be the
    // name they gave the lot rather than its id.
    const [, lot] = buildCameraPresets([square('lot-a', 'Potrero norte', 0, 0, 10)])
    expect(lot.label).toBe('Potrero norte')
  })

  it('aims at the lot it belongs to', () => {
    const [, lot] = buildCameraPresets([square('lot-a', 'A', 25, -15, 8)])
    expect(lot.target[0]).toBeCloseTo(25, 0)
    expect(lot.target[2]).toBeCloseTo(-15, 0)
    // Looking at the ground, not above or below it.
    expect(lot.target[1]).toBe(0)
  })

  it('stands further back for a larger lot', () => {
    // Otherwise a big paddock is framed too tightly to see, which is the whole
    // reason the distance is derived from the extent.
    const [, small] = buildCameraPresets([square('small', 'S', 0, 0, 5)])
    const [, large] = buildCameraPresets([square('large', 'L', 0, 0, 40)])
    const height = (preset: typeof small) => preset.position[1]
    expect(height(large)).toBeGreaterThan(height(small))
  })

  it('keeps the camera above the ground', () => {
    for (const half of [1, 5, 20, 60]) {
      const [, lot] = buildCameraPresets([square('l', 'L', 0, 0, half)])
      // The distance has a constant term precisely so a tiny lot does not put
      // the camera at ground level inside the mesh.
      expect(lot.position[1]).toBeGreaterThan(1)
    }
  })

  it('produces finite coordinates for a degenerate lot', () => {
    // A lot drawn as a single repeated point has zero extent. The result must
    // still be a usable camera rather than NaN, which renders nothing.
    const degenerate = {
      id: 'flat', name: 'Flat',
      boundary: [{ x: 3, z: 3 }, { x: 3, z: 3 }, { x: 3, z: 3 }],
    } as SimulationLot
    const [, lot] = buildCameraPresets([degenerate])
    expect(lot.position.every(Number.isFinite)).toBe(true)
    expect(lot.target.every(Number.isFinite)).toBe(true)
  })
})
