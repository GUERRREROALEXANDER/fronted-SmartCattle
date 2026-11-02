import { describe, expect, it } from 'vitest'
import { FARM_HALF_X, FARM_HALF_Z, heightAt } from './heightfield'

describe('heightAt', () => {
  it('keeps the working farm gentle', () => {
    // The comment promises gentle swells only, and the reason is practical:
    // the herd walks on this and the fences are placed on it, so a metre of
    // relief inside the farm leaves animals floating or buried.
    for (let x = -FARM_HALF_X; x <= FARM_HALF_X; x += 7) {
      for (let z = -FARM_HALF_Z; z <= FARM_HALF_Z; z += 5) {
        expect(Math.abs(heightAt(x, z))).toBeLessThan(0.6)
      }
    }
  })

  it('is deterministic', () => {
    // Every mesh, fence post and animal position is derived from it. A
    // changing ground height would move the whole scene between renders.
    expect(heightAt(12.5, -7.25)).toBe(heightAt(12.5, -7.25))
  })

  it('rises beyond the farm', () => {
    // So the farm reads as a clearing rather than a plane that stops.
    const inside = Math.abs(heightAt(0, 0))
    const faraway = heightAt(FARM_HALF_X + 150, 0)
    expect(faraway).toBeGreaterThan(inside)
  })

  it('does not jump at the farm boundary', () => {
    // The boundary is where a mistake would show as a visible cliff, because
    // that is where the hill term switches on.
    const justInside = heightAt(FARM_HALF_X - 0.01, 0)
    const justOutside = heightAt(FARM_HALF_X + 0.01, 0)
    expect(Math.abs(justOutside - justInside)).toBeLessThan(0.05)
  })

  it('is symmetric in the sense that all four corners rise', () => {
    for (const [x, z] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
      const far = heightAt(x * (FARM_HALF_X + 120), z * (FARM_HALF_Z + 120))
      expect(far).toBeGreaterThan(0)
    }
  })

  it('is finite everywhere it is sampled', () => {
    // A NaN here propagates into the geometry and the mesh disappears without
    // an error, which is the hardest version of this bug to find.
    for (let x = -400; x <= 400; x += 61) {
      for (let z = -400; z <= 400; z += 53) {
        expect(Number.isFinite(heightAt(x, z))).toBe(true)
      }
    }
  })
})
