import { useEffect, useMemo } from 'react'
import { BufferGeometry, Color, Float32BufferAttribute } from 'three'
import {
  distanceToPolygonBoundary,
  pointInPolygon,
  type WorldPoint,
} from '../../simulation/geometry'
import { getMaterials } from '../materials'
import { fbm2, noise2, smoothstep } from '../noise'
import { distanceToPolyline } from './paths'
import { FARM_HALF_X, FARM_HALF_Z, heightAt } from './heightfield'

export interface GroundProps {
  lots: readonly { boundary: readonly WorldPoint[] }[]
  track: readonly WorldPoint[]
  /** Bare, trodden earth around the barn and trough. */
  yards?: readonly { x: number; z: number; radius: number }[]
}

const EXTENT = 220
const TURF_METRES = 1.6

/** Fine near the farm, coarse towards the horizon. */
function axis(half: number) {
  const values: number[] = []
  let value = -EXTENT
  while (value < EXTENT) {
    values.push(value)
    const distance = Math.max(0, Math.abs(value) - half)
    value += distance <= 0 ? 0.5 : Math.min(6, 0.5 + distance * 0.09)
  }
  values.push(EXTENT)
  return values
}

const LUSH = new Color('#45702f')
const BASE = new Color('#6a8a42')
const DRY = new Color('#a39d68')
const GRAZED = new Color('#839657')
const TRODDEN = new Color('#7d6a48')
const YARD = new Color('#6e5a3e')
const FAR = new Color('#557a45')

function createGroundGeometry({ lots, track, yards = [] }: GroundProps) {
  const xs = axis(FARM_HALF_X + 6)
  const zs = axis(FARM_HALF_Z + 6)
  const columns = xs.length
  const positions = new Float32Array(columns * zs.length * 3)
  const colors = new Float32Array(columns * zs.length * 3)
  const uvs = new Float32Array(columns * zs.length * 2)
  const color = new Color()

  zs.forEach((z, row) => {
    xs.forEach((x, column) => {
      const index = row * columns + column
      const y = heightAt(x, z)
      positions.set([x, y, z], index * 3)
      uvs.set([x / TURF_METRES, z / TURF_METRES], index * 2)

      color.copy(BASE).lerp(LUSH, Math.min(1, Math.max(0, (fbm2(x * 0.16, z * 0.16) - 0.45) * 2.2)))
      color.lerp(DRY, Math.min(0.55, Math.max(0, (fbm2(x * 0.045 + 30, z * 0.045) - 0.56) * 2.4)))

      for (const lot of lots) {
        if (!pointInPolygon({ x, z }, lot.boundary)) continue
        const edge = distanceToPolygonBoundary({ x, z }, lot.boundary)
        color.lerp(GRAZED, 0.35 + 0.25 * noise2(x * 0.9, z * 0.9))
        // Cattle wear a path just inside the fence.
        const path = Math.exp(-((edge - 0.75) ** 2) / 0.18) * (0.35 + 0.4 * noise2(x * 1.7, z * 1.7))
        color.lerp(TRODDEN, path)
      }

      const toTrack = distanceToPolyline({ x, z }, track)
      color.lerp(TRODDEN, (1 - smoothstep(1.1, 2.6, toTrack)) * 0.45)
      for (const yard of yards) {
        const d = Math.hypot(x - yard.x, z - yard.z)
        color.lerp(YARD, (1 - smoothstep(yard.radius * 0.45, yard.radius, d)) * (0.55 + 0.3 * noise2(x * 0.8, z * 0.8)))
      }

      const outside = Math.hypot(Math.max(0, Math.abs(x) - FARM_HALF_X), Math.max(0, Math.abs(z) - FARM_HALF_Z))
      color.lerp(FAR, smoothstep(10, 90, outside) * 0.6)
      color.multiplyScalar(0.9 + noise2(x * 2.3, z * 2.3) * 0.16)
      colors.set([color.r, color.g, color.b], index * 3)
    })
  })

  const indices: number[] = []
  for (let row = 0; row < zs.length - 1; row += 1) {
    for (let column = 0; column < columns - 1; column += 1) {
      const a = row * columns + column
      const b = a + 1
      const c = a + columns
      const d = c + 1
      indices.push(a, c, b, b, c, d)
    }
  }

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

export function Ground({ lots, track, yards }: GroundProps) {
  const geometry = useMemo(() => createGroundGeometry({ lots, track, yards }), [lots, track, yards])
  useEffect(() => () => geometry.dispose(), [geometry])

  return <mesh geometry={geometry} material={getMaterials().terrain.ground} receiveShadow />
}
