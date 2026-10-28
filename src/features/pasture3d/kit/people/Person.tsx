import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import { MathUtils } from 'three'
import type { Group } from 'three'
import type { SimulationPerson } from '../../simulation/herdSimulation'
import { hashString } from '../noise'
import { heightAt } from '../terrain/heightfield'
import {
  beltGeometry,
  capGeometry,
  cuffGeometry,
  earGeometry,
  eyeGeometry,
  forearmGeometry,
  hairGeometry,
  handGeometry,
  hatBandGeometry,
  hatGeometry,
  headGeometry,
  neckGeometry,
  noseGeometry,
  pelvisGeometry,
  shinGeometry,
  shoeGeometry,
  tallBootGeometry,
  thighGeometry,
  torsoGeometry,
  upperArmGeometry,
} from './humanGeometry'
import { outfitFor } from './outfits'

export interface PersonProps {
  person: SimulationPerson
  paused?: boolean
}

/** Metres covered by one full gait cycle (two steps). */
const STRIDE = 1.3
const HIP_HEIGHT = 0.905

type Side = 0 | 1
type JointName = 'body' | 'pelvis' | 'torso' | 'head' | `hip${Side}` | `knee${Side}` | `ankle${Side}` | `shoulder${Side}` | `elbow${Side}`

function setZ(joint: Group | null | undefined, value: number) {
  if (joint) joint.rotation.z = value
}

export function Person({ person, paused = false }: PersonProps) {
  const rootRef = useRef<Group>(null)
  const joints = useRef<Partial<Record<JointName, Group | null>>>({})
  const phase = useRef(hashString(person.id) * Math.PI * 2)
  const shouldReduceMotion = useReducedMotion()
  const seed = useMemo(() => hashString(person.id), [person.id])
  const outfit = useMemo(() => outfitFor(person.role, seed), [person.role, seed])
  const stature = 0.95 + seed * 0.08

  useFrame((_, delta) => {
    const root = rootRef.current
    if (root) {
      root.position.set(person.position.x, heightAt(person.position.x, person.position.z), person.position.z)
      root.rotation.y = -person.heading
    }
    if (paused) return

    const still = shouldReduceMotion === true
    if (!still) phase.current += (delta * Math.PI * 2 * person.speed) / STRIDE
    const amount = still ? 0 : 1
    const p = phase.current
    const j = joints.current
    // Joints are found once by name, then cached.
    if (!j.body && root) {
      root.traverse(object => {
        if (object.name) j[object.name as JointName] = object as Group
      })
    }

    for (const side of [0, 1] as const) {
      const phi = p + side * Math.PI
      const hip = 0.4 * Math.sin(phi) * amount
      const swing = Math.max(0, Math.cos(phi + 0.35))
      const knee = -(0.08 + 1.0 * swing * swing) * amount - (still ? 0.02 : 0)
      setZ(j[`hip${side}`], hip)
      setZ(j[`knee${side}`], knee)
      setZ(j[`ankle${side}`], -(hip + knee) * 0.75 + (still ? 0 : 0.12 * Math.max(0, -Math.sin(phi)) * Math.max(0, Math.cos(phi))))
      // Arms swing against the leg on the same side.
      const shoulder = -0.32 * Math.sin(phi) * amount
      setZ(j[`shoulder${side}`], shoulder)
      setZ(j[`elbow${side}`], 0.16 + 0.32 * Math.max(0, shoulder) + (still ? 0.05 : 0))
    }
    const bob = still ? 0 : 0.0325 * Math.cos(2 * p) - 0.0325
    j.body?.position.setY(bob)
    if (j.pelvis) {
      j.pelvis.rotation.y = -0.07 * Math.sin(p) * amount
      j.pelvis.rotation.x = 0.035 * Math.sin(p) * amount
    }
    if (j.torso) {
      j.torso.rotation.y = MathUtils.lerp(0, 0.09 * Math.sin(p), amount)
      j.torso.rotation.z = 0.04
    }
    if (j.head) j.head.rotation.y = -0.06 * Math.sin(p) * amount
  })

  const m = outfit.materials
  const leg = (side: Side) => {
    const z = side === 0 ? 0.095 : -0.095
    return (
      <group key={side} name={`hip${side}`} position={[0, HIP_HEIGHT, z]}>
        <mesh geometry={thighGeometry} material={m.pants} castShadow receiveShadow />
        <group name={`knee${side}`} position={[0, -0.43, 0]}>
          <mesh geometry={shinGeometry} material={m.pants} castShadow receiveShadow />
          <group name={`ankle${side}`} position={[0, -0.41, 0]}>
            <mesh geometry={outfit.tallBoots ? tallBootGeometry : shoeGeometry} material={m.boots} castShadow receiveShadow />
          </group>
        </group>
      </group>
    )
  }
  const arm = (side: Side) => {
    const z = side === 0 ? 0.195 : -0.195
    return (
      <group key={side} name={`shoulder${side}`} position={[0, 1.42, z]} rotation={[side === 0 ? -0.07 : 0.07, 0, 0]}>
        <mesh geometry={upperArmGeometry} material={m.shirt} castShadow receiveShadow />
        <group name={`elbow${side}`} position={[0, -0.28, 0]}>
          <mesh geometry={forearmGeometry} material={outfit.rolledSleeves ? m.skin : m.shirt} castShadow receiveShadow />
          {outfit.rolledSleeves && <mesh geometry={cuffGeometry} material={m.shirt} position={[0, -0.02, 0]} />}
          <group position={[0, -0.25, 0]} rotation={[side === 0 ? 0.1 : -0.1, 0, 0]}>
            <mesh geometry={handGeometry} material={m.skin} scale={[1, 1, side === 0 ? 1 : -1]} castShadow />
          </group>
        </group>
      </group>
    )
  }

  return (
    <group ref={rootRef} position={[person.position.x, 0, person.position.z]} rotation={[0, -person.heading, 0]}>
      <group scale={stature}>
        <group name="body">
          <group name="pelvis">
            <mesh geometry={pelvisGeometry} material={m.pants} scale={[0.72, 1, 1]} castShadow receiveShadow />
            <mesh geometry={beltGeometry} material={m.belt} position={[0, 0.985, 0]} scale={[0.7, 1, 1]} />
            <mesh material={m.buckle} position={[0.104, 0.985, 0]}>
              <boxGeometry args={[0.012, 0.045, 0.06]} />
            </mesh>
            {outfit.machete && (
              <group position={[-0.01, 0.93, 0.155]} rotation={[0.15, 0, -0.5]}>
                <mesh material={m.belt} position={[-0.0, -0.22, 0]} castShadow>
                  <boxGeometry args={[0.07, 0.48, 0.022]} />
                </mesh>
                <mesh material={m.hair} position={[0, 0.06, 0]}>
                  <cylinderGeometry args={[0.016, 0.018, 0.12, 8]} />
                </mesh>
              </group>
            )}
            {leg(0)}
            {leg(1)}
          </group>

          <group name="torso">
            <mesh geometry={torsoGeometry} material={m.shirt} scale={[0.68, 1, 1]} castShadow receiveShadow />
            {outfit.pockets && [-1, 1].map(side => (
              <mesh key={side} material={m.shirt} position={[0.1, 1.33, side * 0.075]} rotation={[0, 0, -0.08]}>
                <boxGeometry args={[0.012, 0.1, 0.085]} />
              </mesh>
            ))}
            <mesh geometry={neckGeometry} material={m.skin} castShadow />
            <mesh material={m.shirt} position={[0, 1.49, 0]} rotation={[0, 0, 0.12]} scale={[0.85, 1, 1]}>
              <torusGeometry args={[0.07, 0.016, 6, 20]} />
            </mesh>
            {arm(0)}
            {arm(1)}

            <group name="head" position={[0, 1.56, 0]}>
              <group position={[0, -1.56, 0]}>
                <mesh geometry={headGeometry} material={m.skin} castShadow receiveShadow />
                <mesh geometry={hairGeometry} material={m.hair} position={[-0.006, 1.682, 0]} />
                <mesh geometry={noseGeometry} material={m.skin} position={[0.1, 1.655, 0]} />
                {[-1, 1].map(side => (
                  <group key={side}>
                    <mesh geometry={earGeometry} material={m.skin} position={[-0.004, 1.67, side * 0.09]} />
                    <mesh geometry={eyeGeometry} material={m.eye} position={[0.087, 1.695, side * 0.034]} />
                  </group>
                ))}
                {outfit.mustache && (
                  <mesh material={m.hair} position={[0.098, 1.628, 0]} rotation={[0, 0, -0.25]}>
                    <boxGeometry args={[0.012, 0.014, 0.06]} />
                  </mesh>
                )}
                {outfit.hat === 'straw' ? (
                  <group position={[-0.008, 1.735, 0]} rotation={[0, 0, -0.06]}>
                    <mesh geometry={hatGeometry} material={m.hat} castShadow receiveShadow />
                    <mesh geometry={hatBandGeometry} material={m.hatBand} position={[0, 0.018, 0]} scale={[1.02, 1.4, 1.02]} />
                  </group>
                ) : (
                  <mesh geometry={capGeometry} material={m.hat} position={[0, 1.735, 0]} rotation={[0, 0, -0.08]} castShadow />
                )}
              </group>
            </group>
          </group>
        </group>
      </group>
    </group>
  )
}
