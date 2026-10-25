import { useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import type { WorldPoint } from '../../simulation/geometry'
import { materials } from '../materials'

interface PlanarPoint {
  x: number
  z: number
}

export interface TrackProps {
  points: readonly WorldPoint[]
  width?: number
}

function createTrackGeometry(points: readonly WorldPoint[], width: number) {
  const path = points.filter((point, index) => {
    if (index === 0) return true
    const previous = points[index - 1]
    return Math.hypot(point.x - previous.x, point.z - previous.z) > 0.0001
  })

  if (path.length < 2) return null

  const directions = path.slice(0, -1).map((point, index) => {
    const next = path[index + 1]
    const length = Math.hypot(next.x - point.x, next.z - point.z)
    return { x: (next.x - point.x) / length, z: (next.z - point.z) / length }
  })
  const halfWidth = Math.max(0.05, width) / 2
  const positions: number[] = []
  const indices: number[] = []

  path.forEach((point, index) => {
    const previousDirection = directions[Math.max(0, index - 1)]
    const nextDirection = directions[Math.min(index, directions.length - 1)]
    const previousNormal = { x: -previousDirection.z, z: previousDirection.x }
    const nextNormal = { x: -nextDirection.z, z: nextDirection.x }
    let normal: PlanarPoint = nextNormal
    let miterScale = 1

    if (index > 0 && index < path.length - 1) {
      const miter = {
        x: previousNormal.x + nextNormal.x,
        z: previousNormal.z + nextNormal.z,
      }
      const miterLength = Math.hypot(miter.x, miter.z)

      if (miterLength > 0.0001) {
        normal = { x: miter.x / miterLength, z: miter.z / miterLength }
        const denominator = Math.abs(
          normal.x * nextNormal.x + normal.z * nextNormal.z,
        )
        miterScale = Math.min(2.5, 1 / Math.max(0.25, denominator))
      }
    }

    const offsetX = normal.x * halfWidth * miterScale
    const offsetZ = normal.z * halfWidth * miterScale
    positions.push(
      point.x + offsetX, 0, point.z + offsetZ,
      point.x - offsetX, 0, point.z - offsetZ,
    )

    if (index < path.length - 1) {
      const a = index * 2
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  })

  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

export function Track({ points, width = 1.6 }: TrackProps) {
  const geometry = useMemo(() => createTrackGeometry(points, width), [points, width])

  if (!geometry) return null

  return (
    <mesh
      geometry={geometry}
      material={materials.terrain.track}
      position={[0, 0.012, 0]}
      receiveShadow
    />
  )
}
