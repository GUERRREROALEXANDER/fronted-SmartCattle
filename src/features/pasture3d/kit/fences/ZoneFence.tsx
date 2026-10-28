import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import {
  BufferGeometry,
  Color,
  Euler,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  Quaternion,
  Vector3,
} from 'three'
import type { MeshStandardMaterial } from 'three'
import type { WorldPoint } from '../../simulation/geometry'
import { ALERT_COLOR, getMaterials } from '../materials'
import { heightAt } from '../terrain/heightfield'
import { resample } from '../terrain/paths'
import { signTexture } from '../textures'
import {
  cleanBoundary,
  layoutFence,
  postGeometry,
  railGeometry,
  RAIL_HEIGHTS,
  tubeGeometry,
  WIRE_HEIGHT,
  wireGeometry,
} from './fenceGeometry'

export interface ZoneFenceLot {
  id: string
  name: string
  boundary: readonly WorldPoint[]
}

export interface ZoneFenceProps {
  lot: ZoneFenceLot
  track: readonly WorldPoint[]
  breached: boolean
}

const WHITE = new Color(1, 1, 1)
const RED_TINT = new Color(1, 0.16, 0.12)
const BLACK = new Color(0, 0, 0)

/** Flat ribbon that hugs the ground along the fence: the breach glow. */
function createGlowGeometry(boundary: readonly WorldPoint[]) {
  const loop = resample([...boundary, boundary[0]], 1)
  const positions: number[] = []
  const indices: number[] = []
  loop.forEach((point, index) => {
    const previous = loop[Math.max(0, index - 1)]
    const next = loop[Math.min(loop.length - 1, index + 1)]
    const dx = next.x - previous.x
    const dz = next.z - previous.z
    const length = Math.hypot(dx, dz) || 1
    for (const side of [0.55, -0.55]) {
      const x = point.x - (dz / length) * side
      const z = point.z + (dx / length) * side
      positions.push(x, heightAt(x, z) + 0.06, z)
    }
    if (index < loop.length - 1) {
      const a = index * 2
      indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3)
    }
  })
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setIndex(indices)
  geometry.computeBoundingSphere()
  return geometry
}

function cloneFor(material: MeshStandardMaterial) {
  const clone = material.clone()
  clone.emissive = new Color(0, 0, 0)
  return clone
}

export function ZoneFence({ lot, track, breached }: ZoneFenceProps) {
  const shouldReduceMotion = useReducedMotion()
  const boundary = useMemo(() => cleanBoundary(lot.boundary), [lot.boundary])
  const layout = useMemo(() => layoutFence(boundary, track), [boundary, track])
  const glowGeometry = useMemo(() => createGlowGeometry(boundary), [boundary])
  // Each lot owns its materials so only the breached one turns red.
  const fenceMaterials = useMemo(() => {
    const shared = getMaterials().fence
    const rail = cloneFor(shared.wood)
    if (rail.map) {
      const map = rail.map.clone()
      map.center.set(0.5, 0.5)
      map.rotation = Math.PI / 2
      rail.map = map
      rail.bumpMap = map
    }
    return {
      post: cloneFor(shared.wood),
      rail,
      wire: cloneFor(shared.wire),
      gate: cloneFor(getMaterials().structure.galvanized),
      glow: new MeshBasicMaterial({ color: ALERT_COLOR, transparent: true, opacity: 0, depthWrite: false, toneMapped: false }),
    }
  }, [])
  const signMaterial = useMemo(() => {
    const material = getMaterials().structure.trim.clone()
    material.map = signTexture(lot.name)
    material.color.set('#ffffff')
    return material
  }, [lot.name])

  const postsRef = useRef<InstancedMesh>(null)
  const railsRef = useRef<InstancedMesh>(null)
  const wiresRef = useRef<InstancedMesh>(null)

  useEffect(() => () => {
    Object.values(fenceMaterials).forEach(material => material.dispose())
    fenceMaterials.rail.map?.dispose()
  }, [fenceMaterials])
  useEffect(() => () => signMaterial.dispose(), [signMaterial])
  useEffect(() => () => glowGeometry.dispose(), [glowGeometry])

  useLayoutEffect(() => {
    const matrix = new Matrix4()
    const quaternion = new Quaternion()
    const euler = new Euler()
    const position = new Vector3()
    const scale = new Vector3()
    layout.posts.forEach((post, index) => {
      euler.set(post.tilt, post.spin, post.tilt * 0.7)
      matrix.compose(position.set(post.x, post.y, post.z), quaternion.setFromEuler(euler), scale.set(post.thickness, post.height, post.thickness))
      postsRef.current?.setMatrixAt(index, matrix)
    })
    let rail = 0
    layout.spans.forEach((span, index) => {
      const dx = span.b.x - span.a.x
      const dz = span.b.z - span.a.z
      const length = Math.hypot(dx, dz)
      const pitch = Math.atan2(span.yb - span.ya, length)
      euler.set(0, -Math.atan2(dz, dx), pitch, 'YZX')
      quaternion.setFromEuler(euler)
      const midY = (span.ya + span.yb) / 2
      const ox = span.outward.x * 0.1
      const oz = span.outward.z * 0.1
      for (const height of RAIL_HEIGHTS) {
        matrix.compose(position.set(span.a.x + dx / 2 + ox, midY + height, span.a.z + dz / 2 + oz), quaternion, scale.set(length + 0.12, 1, 1))
        railsRef.current?.setMatrixAt(rail, matrix)
        rail += 1
      }
      // A slight sag in the wire reads as real tension.
      matrix.compose(position.set(span.a.x + dx / 2 + ox * 0.7, midY + WIRE_HEIGHT - 0.015, span.a.z + dz / 2 + oz * 0.7), quaternion, scale.set(length, 1, 1))
      wiresRef.current?.setMatrixAt(index, matrix)
    })
    for (const mesh of [postsRef.current, railsRef.current, wiresRef.current]) {
      if (!mesh) continue
      mesh.instanceMatrix.needsUpdate = true
      mesh.computeBoundingSphere()
    }
  }, [layout])

  useFrame((state, delta) => {
    const blend = 1 - Math.exp(-delta * 6)
    const pulse = shouldReduceMotion ? 1 : 0.65 + Math.sin(state.clock.elapsedTime * 4) * 0.35
    const tint = breached ? RED_TINT : WHITE
    const glow = breached ? ALERT_COLOR : BLACK
    for (const material of [fenceMaterials.post, fenceMaterials.rail, fenceMaterials.wire, fenceMaterials.gate]) {
      material.color.lerp(tint, blend)
      material.emissive.lerp(glow, blend)
      material.setValues({ emissiveIntensity: breached ? 0.55 + pulse * 0.6 : 0 })
    }
    const opacity = breached ? 0.35 + pulse * 0.35 : 0
    fenceMaterials.glow.setValues({ opacity: fenceMaterials.glow.opacity + (opacity - fenceMaterials.glow.opacity) * blend })
  })

  const { gate } = layout
  const railCount = layout.spans.length * RAIL_HEIGHTS.length

  return (
    <group name={`zone-${lot.id}`} userData={{ lotName: lot.name }}>
      <instancedMesh ref={postsRef} args={[postGeometry, fenceMaterials.post, layout.posts.length]} castShadow receiveShadow />
      <instancedMesh ref={railsRef} args={[railGeometry, fenceMaterials.rail, railCount]} castShadow receiveShadow />
      <instancedMesh ref={wiresRef} args={[wireGeometry, fenceMaterials.wire, layout.spans.length]} />
      <mesh geometry={glowGeometry} material={fenceMaterials.glow} renderOrder={2} />
      {gate && (
        <group position={[gate.center.x, gate.y, gate.center.z]} rotation={[0, -gate.angle, 0]}>
          {/* Five-bar tubular gate with a diagonal brace, hung between the two gate posts. */}
          {[0.25, 0.48, 0.71, 0.94, 1.17].map(height => (
            <mesh key={height} geometry={tubeGeometry} material={fenceMaterials.gate} position={[0, height, 0]} scale={[gate.width - 0.25, 1, 1]} castShadow />
          ))}
          {[-1, 1].map(side => (
            <mesh
              key={side}
              geometry={tubeGeometry}
              material={fenceMaterials.gate}
              position={[side * (gate.width / 2 - 0.13), 0.71, 0]}
              rotation={[0, 0, Math.PI / 2]}
              scale={[0.98, 1.2, 1.2]}
              castShadow
            />
          ))}
          <mesh
            geometry={tubeGeometry}
            material={fenceMaterials.gate}
            position={[0, 0.71, 0]}
            rotation={[0, 0, Math.atan2(0.92, gate.width - 0.3)]}
            scale={[Math.hypot(0.92, gate.width - 0.3), 0.8, 0.8]}
            castShadow
          />
          {/* Lot name board beside the gate, facing the track. */}
          <group
            position={[gate.width / 2 + 1.3, 0, 0.7 * (gate.outward.z * Math.cos(gate.angle) - gate.outward.x * Math.sin(gate.angle))]}
            rotation={[0, Math.atan2(gate.outward.x, gate.outward.z) + gate.angle, 0]}
          >
            {[-0.42, 0.42].map(x => (
              <mesh key={x} geometry={postGeometry} material={fenceMaterials.post} position={[x, 0, 0]} scale={[0.6, 1.25, 0.6]} castShadow />
            ))}
            <mesh material={signMaterial} position={[0, 1.02, 0.06]} castShadow>
              <boxGeometry args={[1.25, 0.47, 0.04]} />
            </mesh>
          </group>
        </group>
      )}
    </group>
  )
}
