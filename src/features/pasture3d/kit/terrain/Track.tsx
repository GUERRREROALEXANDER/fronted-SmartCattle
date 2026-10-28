import { useEffect, useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import type { WorldPoint } from '../../simulation/geometry'
import { getMaterials } from '../materials'
import { heightAt } from './heightfield'
import { resample } from './paths'

export interface TrackProps {
  points: readonly WorldPoint[]
  width?: number
}

const TEXTURE_METRES = 3.5

function createTrackGeometry(points: readonly WorldPoint[], width: number) {
  const path = resample(points, 0.75)
  if (path.length < 2) return null
  const half = width / 2
  const positions: number[] = []
  const uvs: number[] = []
  const indices: number[] = []
  let travelled = 0

  path.forEach((point, index) => {
    const previous = path[Math.max(0, index - 1)]
    const next = path[Math.min(path.length - 1, index + 1)]
    const dx = next.x - previous.x
    const dz = next.z - previous.z
    const length = Math.hypot(dx, dz) || 1
    const nx = -dz / length
    const nz = dx / length
    if (index > 0) travelled += Math.hypot(point.x - previous.x, point.z - previous.z)
    for (const side of [1, -1]) {
      const x = point.x + nx * half * side
      const z = point.z + nz * half * side
      positions.push(x, heightAt(x, z) + 0.03, z)
      uvs.push(side > 0 ? 0 : 1, travelled / TEXTURE_METRES)
    }
    if (index < path.length - 1) {
      const a = index * 2
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  })

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('uv', new Float32BufferAttribute(uvs, 2))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

export function Track({ points, width = 2.6 }: TrackProps) {
  const geometry = useMemo(() => createTrackGeometry(points, width), [points, width])
  useEffect(() => () => geometry?.dispose(), [geometry])
  if (!geometry) return null
  return <mesh geometry={geometry} material={getMaterials().terrain.road} receiveShadow renderOrder={1} />
}
