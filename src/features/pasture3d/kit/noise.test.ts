import { describe, expect, it } from 'vitest'
import { fbm2, hash2, hashString, noise2, smoothstep } from './noise'

describe('hash2', () => {
  it('stays inside 0..1', () => {
    for (let x = -5; x <= 5; x += 1.3) {
      for (let z = -5; z <= 5; z += 1.7) {
        const value = hash2(x, z)
        expect(value).toBeGreaterThanOrEqual(0)
        expect(value).toBeLessThan(1)
      }
    }
  })

  it('is deterministic', () => {
    // The whole terrain, the scatter and the textures are derived from this.
    // If it were not stable, the pasture would look different on every render.
    expect(hash2(3, 7)).toBe(hash2(3, 7))
  })

  it('separates neighbouring cells', () => {
    // Adjacent integers returning the same value would make the terrain flat
    // in patches rather than varied.
    expect(hash2(3, 7)).not.toBe(hash2(4, 7))
    expect(hash2(3, 7)).not.toBe(hash2(3, 8))
  })
})

describe('noise2', () => {
  it('is continuous across a cell boundary', () => {
    // A visible seam at every integer is what an interpolation mistake looks
    // like on the ground.
    const before = noise2(2 - 1e-6, 5.5)
    const after = noise2(2 + 1e-6, 5.5)
    expect(Math.abs(after - before)).toBeLessThan(1e-3)
  })

  it('returns the cell corner exactly at integer coordinates', () => {
    expect(noise2(4, 9)).toBeCloseTo(hash2(4, 9), 10)
  })

  it('stays inside 0..1', () => {
    for (let x = 0; x < 8; x += 0.37) {
      const value = noise2(x, x * 1.7)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })
})

describe('fbm2', () => {
  it('stays inside 0..1', () => {
    // The octave weights sum to 1, so the result cannot leave the range of a
    // single octave. heightAt scales this, and a value outside the range there
    // becomes terrain that cuts through the fences.
    for (let x = -20; x <= 20; x += 3.1) {
      const value = fbm2(x, x * 0.6)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(1)
    }
  })

  it('has a mean near the documented 0.5', () => {
    // The comment promises it, and heightAt subtracts 0.5 to centre the
    // swells on zero. A drifting mean tilts the whole farm.
    let total = 0
    let samples = 0
    for (let x = -30; x <= 30; x += 1.7) {
      for (let z = -30; z <= 30; z += 2.3) {
        total += fbm2(x, z)
        samples += 1
      }
    }
    expect(total / samples).toBeCloseTo(0.5, 1)
  })
})

describe('smoothstep', () => {
  it('clamps outside the edges', () => {
    expect(smoothstep(0, 10, -5)).toBe(0)
    expect(smoothstep(0, 10, 15)).toBe(1)
  })

  it('is exactly a half at the midpoint', () => {
    expect(smoothstep(0, 10, 5)).toBeCloseTo(0.5, 10)
  })

  it('is flat at both edges', () => {
    // That flatness is the point of smoothstep over a linear ramp: the terrain
    // meets the farm boundary without a crease.
    expect(smoothstep(0, 10, 0.01) - smoothstep(0, 10, 0)).toBeLessThan(1e-4)
    expect(smoothstep(0, 10, 10) - smoothstep(0, 10, 9.99)).toBeLessThan(1e-4)
  })

  it('increases monotonically', () => {
    let previous = -1
    for (let value = 0; value <= 10; value += 0.5) {
      const current = smoothstep(0, 10, value)
      expect(current).toBeGreaterThanOrEqual(previous)
      previous = current
    }
  })
})

describe('hashString', () => {
  it('is stable for the same id', () => {
    // Each cow keeps its look across renders because of this. An unstable
    // hash would make the herd change colour whenever the scene re-renders.
    expect(hashString('cow-7')).toBe(hashString('cow-7'))
  })

  it('separates similar ids', () => {
    expect(hashString('cow-7')).not.toBe(hashString('cow-8'))
    expect(hashString('cow-7')).not.toBe(hashString('cow-70'))
  })

  it('stays inside 0..1', () => {
    for (const id of ['', 'a', 'cow-1', 'person-42', 'árbol-ñ', 'x'.repeat(200)]) {
      const value = hashString(id)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThan(1)
    }
  })

  it('handles an empty id without failing', () => {
    expect(Number.isFinite(hashString(''))).toBe(true)
  })
})
