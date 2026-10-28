import { useLayoutEffect, useMemo, useRef } from 'react'
import { Euler, InstancedMesh, Matrix4, Quaternion, Vector3 } from 'three'
import type { WorldPoint } from '../../simulation/geometry'
import { getMaterials } from '../materials'
import { hash2 } from '../noise'
import { heightAt } from '../terrain/heightfield'
import { distanceToPolyline } from '../terrain/paths'
import { postGeometry, wireGeometry } from './fenceGeometry'

export interface PerimeterFenceProps {
  /** Rectangle half extents of the farm boundary. */
  halfX: number
  halfZ: number
  track: readonly WorldPoint[]
}

const SPACING = 3
const OPENING = 2.8
const STRANDS = [0.42, 0.8, 1.16]

interface Portal { a: WorldPoint; b: WorldPoint }

function layout(halfX: number, halfZ: number, track: readonly WorldPoint[]) {
  const corners = [
    { x: -halfX, z: -halfZ }, { x: halfX, z: -halfZ },
    { x: halfX, z: halfZ }, { x: -halfX, z: halfZ },
  ]
  const posts: WorldPoint[] = []
  const spans: [WorldPoint, WorldPoint][] = []
  const portals: Portal[] = []
  corners.forEach((start, index) => {
    const end = corners[(index + 1) % 4]
    const length = Math.hypot(end.x - start.x, end.z - start.z)
    const count = Math.round(length / SPACING)
    const stations = Array.from({ length: count + 1 }, (_, k) => ({
      x: start.x + ((end.x - start.x) * k) / count,
      z: start.z + ((end.z - start.z) * k) / count,
    }))
    const open = stations.map(point => distanceToPolyline(point, track) < OPENING)
    stations.forEach((point, k) => {
      if (k < count && !open[k]) posts.push(point)
      if (k < count && !open[k] && !open[k + 1]) spans.push([point, stations[k + 1]])
      if (k < count && !open[k] && open[k + 1]) {
        let j = k + 1
        while (j < count && open[j]) j += 1
        portals.push({ a: point, b: stations[j] })
      }
    })
  })
  return { posts, spans, portals }
}

export function PerimeterFence({ halfX, halfZ, track }: PerimeterFenceProps) {
  const materials = getMaterials()
  const { posts, spans, portals } = useMemo(() => layout(halfX, halfZ, track), [halfX, halfZ, track])
  const postsRef = useRef<InstancedMesh>(null)
  const wiresRef = useRef<InstancedMesh>(null)

  useLayoutEffect(() => {
    const matrix = new Matrix4()
    const quaternion = new Quaternion()
    const euler = new Euler()
    const position = new Vector3()
    const scale = new Vector3()
    posts.forEach((point, index) => {
      const h = hash2(point.x * 1.3, point.z * 2.1)
      euler.set((h - 0.5) * 0.08, h * 6, (h - 0.5) * 0.05)
      matrix.compose(position.set(point.x, heightAt(point.x, point.z), point.z), quaternion.setFromEuler(euler), scale.set(0.8, 1.3 + h * 0.12, 0.8))
      postsRef.current?.setMatrixAt(index, matrix)
    })
    let wire = 0
    spans.forEach(([a, b]) => {
      const dx = b.x - a.x
      const dz = b.z - a.z
      const length = Math.hypot(dx, dz)
      const ya = heightAt(a.x, a.z)
      const yb = heightAt(b.x, b.z)
      euler.set(0, -Math.atan2(dz, dx), Math.atan2(yb - ya, length), 'YZX')
      quaternion.setFromEuler(euler)
      for (const strand of STRANDS) {
        matrix.compose(position.set(a.x + dx / 2, (ya + yb) / 2 + strand - 0.02, a.z + dz / 2), quaternion, scale.set(length, 1, 1))
        wiresRef.current?.setMatrixAt(wire, matrix)
        wire += 1
      }
    })
    for (const mesh of [postsRef.current, wiresRef.current]) {
      if (!mesh) continue
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
  }, [posts, spans])

  return (
    <group name="farm-boundary">
      <instancedMesh ref={postsRef} args={[postGeometry, materials.fence.wood, posts.length]} castShadow receiveShadow />
      <instancedMesh ref={wiresRef} args={[wireGeometry, materials.fence.wire, spans.length * STRANDS.length]} />
      {portals.map(({ a, b }) => {
        const dx = b.x - a.x
        const dz = b.z - a.z
        const width = Math.hypot(dx, dz)
        const y = Math.min(heightAt(a.x, a.z), heightAt(b.x, b.z))
        return (
          <group key={`${a.x}:${a.z}`} position={[(a.x + b.x) / 2, y, (a.z + b.z) / 2]} rotation={[0, -Math.atan2(dz, dx), 0]}>
            {/* Entrance portal: two heavy posts and a crossbeam over the road. */}
            {[-1, 1].map(side => (
              <mesh key={side} geometry={postGeometry} material={materials.fence.wood} position={[side * width / 2, 0, 0]} scale={[2.2, 4.2, 2.2]} castShadow receiveShadow />
            ))}
            <mesh material={materials.fence.wood} position={[0, 3.9, 0]} castShadow>
              <boxGeometry args={[width + 1.2, 0.26, 0.2]} />
            </mesh>
          </group>
        )
      })}
    </group>
  )
}
