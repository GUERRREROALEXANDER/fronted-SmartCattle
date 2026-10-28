import {
  BufferGeometry,
  LatheGeometry,
  SphereGeometry,
  TorusGeometry,
  Vector2,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'

// All parts are built for a 1.76 m adult, forward = +X, up = +Y.

function lathe(profile: [number, number][], segments = 20) {
  return new LatheGeometry(profile.map(([r, y]) => new Vector2(Math.max(r, 0.0001), y)), segments)
}

/** Tapered capsule hanging down from its joint at y = 0. */
export function limb(r0: number, r1: number, length: number, segments = 16) {
  const profile: [number, number][] = []
  for (let k = 0; k <= 5; k += 1) {
    const a = (k / 5) * (Math.PI / 2)
    profile.push([r1 * Math.sin(a), -length - r1 * Math.cos(a)])
  }
  // Slight muscle belly in the upper third.
  profile.push([r0 * 1.04 + (r1 - r0) * 0.35, -length * 0.62])
  profile.push([r0 * 1.06, -length * 0.3])
  for (let k = 5; k >= 0; k -= 1) {
    const a = (k / 5) * (Math.PI / 2)
    profile.push([r0 * Math.sin(a), r0 * Math.cos(a) * 0.6])
  }
  return lathe(profile, segments)
}

/** Shirt torso from waist to the base of the neck; scale X ~0.66 for an oval chest. */
export const torsoGeometry = lathe([
  [0.0001, 0.98],
  [0.145, 0.985],
  [0.142, 1.06],
  [0.147, 1.16],
  [0.158, 1.26],
  [0.166, 1.34],
  [0.17, 1.4],
  [0.15, 1.46],
  [0.1, 1.5],
  [0.055, 1.52],
  [0.0001, 1.525],
], 28)

/** Hips and seat, in trouser fabric. */
export const pelvisGeometry = lathe([
  [0.0001, 0.83],
  [0.1, 0.84],
  [0.15, 0.89],
  [0.157, 0.95],
  [0.147, 1.0],
  [0.0001, 1.005],
], 24)

export const neckGeometry = lathe([
  [0.0001, 1.48],
  [0.058, 1.48],
  [0.05, 1.53],
  [0.048, 1.6],
  [0.0001, 1.6],
], 14)

/** Head with jaw and brow shaping, centred on y = 1.66. */
export const headGeometry = (() => {
  const geometry = new SphereGeometry(1, 28, 20)
  const position = geometry.getAttribute('position')
  for (let k = 0; k < position.count; k += 1) {
    let x = position.getX(k)
    let y = position.getY(k)
    let z = position.getZ(k)
    // Narrower jaw and chin, flatter sides, a little brow.
    const jaw = y < -0.1 ? 1 - (-y - 0.1) * 0.35 : 1
    z *= jaw * 0.86
    x *= (y < -0.2 ? 0.92 : 1) * (x > 0.6 && y > 0.15 && y < 0.35 ? 1.04 : 1)
    if (x > 0 && y < -0.3) x += 0.06 * (1 - Math.abs(z))
    y *= 1.18
    position.setXYZ(k, x * 0.1, y * 0.1 + 1.67, z * 0.1)
  }
  geometry.computeVertexNormals()
  return geometry
})()

export const noseGeometry = new SphereGeometry(0.022, 10, 8).scale(1, 1.3, 0.9)
export const earGeometry = new SphereGeometry(0.03, 10, 8).scale(0.45, 1, 0.8)
export const eyeGeometry = new SphereGeometry(0.011, 8, 6)
/** Hair shell: back and top of the skull, under the hat. */
export const hairGeometry = new SphereGeometry(0.104, 24, 14, Math.PI + 0.6, Math.PI * 2 - 1.2, 0, Math.PI * 0.6)
  .scale(1.02, 1.2, 0.9)

/** Aguadeño straw hat: dented crown and a brim that dips front and back. */
export const hatGeometry = (() => {
  const crown = lathe([
    [0.0001, 0.12],
    [0.06, 0.118],
    [0.085, 0.11],
    [0.098, 0.07],
    [0.104, 0.0],
  ], 28)
  const brim = lathe([
    [0.104, 0.0],
    [0.16, -0.008],
    [0.21, -0.016],
    [0.235, -0.01],
    [0.236, -0.0],
    [0.21, -0.006],
    [0.104, 0.008],
  ], 36)
  const position = brim.getAttribute('position')
  for (let k = 0; k < position.count; k += 1) {
    const x = position.getX(k)
    const z = position.getZ(k)
    const r = Math.hypot(x, z)
    // Sides curl up, front and back dip: the classic rancher brim.
    const curl = Math.max(0, r - 0.13) * ((z * z - x * x) / Math.max(r * r, 1e-4)) * 0.5
    position.setY(k, position.getY(k) + curl)
  }
  brim.computeVertexNormals()
  const merged = mergeGeometries([crown, brim])
  crown.dispose()
  brim.dispose()
  return merged
})()

export const hatBandGeometry = new TorusGeometry(0.1, 0.012, 6, 28).rotateX(Math.PI / 2)
export const capGeometry = (() => {
  const dome = new SphereGeometry(0.112, 24, 12, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.05, 0.8, 0.95)
  const visor = lathe([[0.0001, 0], [0.1, 0], [0.1, 0.006], [0.0001, 0.006]], 24).scale(0.9, 1, 1)
  visor.translate(0.08, 0, 0)
  const merged = mergeGeometries([dome.toNonIndexed(), visor.toNonIndexed()])
  dome.dispose()
  visor.dispose()
  merged.computeVertexNormals()
  return merged
})()

export const beltGeometry = new TorusGeometry(0.148, 0.018, 6, 32).rotateX(Math.PI / 2)
export const handGeometry = (() => {
  const palm = new SphereGeometry(0.045, 14, 10).scale(0.55, 1.15, 1)
  palm.translate(0, -0.05, 0)
  const thumb = new SphereGeometry(0.016, 8, 6).scale(1, 2, 1)
  thumb.translate(0.02, -0.04, 0.03)
  const merged = mergeGeometries([palm, thumb])
  palm.dispose()
  thumb.dispose()
  return merged
})()

/** Boot: shaft up the calf, rounded toe, heel block. Origin at the ankle joint. */
export function bootGeometry(tall: boolean): BufferGeometry {
  const shaftHeight = tall ? 0.3 : 0.1
  const shaft = lathe([
    [0.0001, -0.035],
    [0.055, -0.035],
    [0.056, shaftHeight * 0.5],
    [0.062, shaftHeight],
    [0.0001, shaftHeight],
  ], 18)
  const foot = new SphereGeometry(1, 20, 12)
  const position = foot.getAttribute('position')
  for (let k = 0; k < position.count; k += 1) {
    const x = position.getX(k)
    const y = position.getY(k)
    const z = position.getZ(k)
    // Flat sole, long toe, taller at the instep.
    position.setXYZ(k, x * 0.13 + 0.045, Math.max(y, -0.35) * 0.055 - 0.045 + (x < 0 ? 0.01 : 0), z * 0.05 * (1 - Math.max(0, x) * 0.25))
  }
  foot.computeVertexNormals()
  const merged = mergeGeometries([shaft.toNonIndexed(), foot.toNonIndexed()])
  shaft.dispose()
  foot.dispose()
  merged.computeVertexNormals()
  return merged
}

export const thighGeometry = limb(0.083, 0.06, 0.43)
export const shinGeometry = limb(0.058, 0.044, 0.41)
export const upperArmGeometry = limb(0.052, 0.043, 0.28)
export const forearmGeometry = limb(0.042, 0.032, 0.24)
export const cuffGeometry = new TorusGeometry(0.045, 0.012, 6, 16).rotateX(Math.PI / 2)
export const tallBootGeometry = bootGeometry(true)
export const shoeGeometry = bootGeometry(false)
