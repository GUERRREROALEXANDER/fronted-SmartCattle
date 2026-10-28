import { fbm2, smoothstep } from '../noise'

/** Half extents of the working farm: gentle swells only, so herds and fences sit naturally. */
export const FARM_HALF_X = 52
export const FARM_HALF_Z = 36

/** Ground height in metres. Soft swells inside the farm, rolling hills beyond it. */
export function heightAt(x: number, z: number) {
  const swell = (fbm2(x * 0.032 + 3.1, z * 0.032 + 7.7) - 0.5) * 0.9
  const dx = Math.max(0, Math.abs(x) - FARM_HALF_X)
  const dz = Math.max(0, Math.abs(z) - FARM_HALF_Z)
  const outside = Math.hypot(dx, dz)
  if (outside <= 0) return swell
  const rise = smoothstep(0, 60, outside)
  const hills = (fbm2(x * 0.014 + 11, z * 0.014 - 4) - 0.32) * 34
  return swell + rise * Math.max(-1, hills) + smoothstep(40, 160, outside) * 10
}
