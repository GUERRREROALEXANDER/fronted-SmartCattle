import { useMemo } from 'react'
import { Quaternion, Vector3 } from 'three'
import type { MeshStandardMaterial } from 'three'
import type { WorldPoint } from '../../simulation/geometry'
import { fenceWireGeometry } from '../geometries'
import { materials } from '../materials'
import { FencePost, FENCE_POST_HEIGHT } from './FencePost'

const UP = new Vector3(0, 1, 0)
const WIRE_LEVELS = [0.32, 0.64, 0.94] as const

interface WireSegment {
  position: [number, number, number]
  quaternion: Quaternion
  length: number
}

export interface FenceLineProps {
  points: readonly WorldPoint[]
  closed?: boolean
  postHeight?: number
  postSpacing?: number
  postMaterial?: MeshStandardMaterial
  wireMaterial?: MeshStandardMaterial
}

function samePoint(a: WorldPoint, b: WorldPoint) {
  return Math.hypot(a.x - b.x, a.z - b.z) < 0.0001
}

export function FenceLine({
  points,
  closed = true,
  postHeight = FENCE_POST_HEIGHT,
  postSpacing = 3,
  postMaterial = materials.fence.post,
  wireMaterial = materials.fence.wire,
}: FenceLineProps) {
  const { posts, wires } = useMemo(() => {
    const path = points.filter((point, index) => {
      if (index === 0) return true
      return !samePoint(point, points[index - 1])
    })
    const explicitlyClosed = path.length > 2 && samePoint(path[0], path[path.length - 1])

    if (explicitlyClosed) path.pop()

    const isClosed = (closed || explicitlyClosed) && path.length > 2
    const segmentCount = isClosed ? path.length : Math.max(0, path.length - 1)
    const nextPosts: [number, number, number][] = []
    const nextWires: WireSegment[] = []
    const spacing = Math.max(0.25, postSpacing)

    for (let index = 0; index < segmentCount; index += 1) {
      const start = path[index]
      const end = path[(index + 1) % path.length]
      const dx = end.x - start.x
      const dz = end.z - start.z
      const length = Math.hypot(dx, dz)

      if (length < 0.0001) continue

      const subdivisions = Math.max(1, Math.ceil(length / spacing))
      for (let step = 0; step < subdivisions; step += 1) {
        const t = step / subdivisions
        nextPosts.push([start.x + dx * t, 0, start.z + dz * t])
      }

      const quaternion = new Quaternion().setFromUnitVectors(
        UP,
        new Vector3(dx / length, 0, dz / length),
      )

      WIRE_LEVELS.forEach((level) => {
        nextWires.push({
          position: [start.x + dx / 2, postHeight * level, start.z + dz / 2],
          quaternion,
          length,
        })
      })
    }

    if (!isClosed && path.length > 0) {
      const last = path[path.length - 1]
      nextPosts.push([last.x, 0, last.z])
    }

    return { posts: nextPosts, wires: nextWires }
  }, [closed, points, postHeight, postSpacing])

  return (
    <group>
      {posts.map((position, index) => (
        <FencePost
          key={`post-${index}`}
          position={position}
          height={postHeight}
          material={postMaterial}
        />
      ))}
      {wires.map((wire, index) => (
        <mesh
          key={`wire-${index}`}
          geometry={fenceWireGeometry}
          material={wireMaterial}
          position={wire.position}
          quaternion={wire.quaternion}
          scale={[1, wire.length, 1]}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  )
}
