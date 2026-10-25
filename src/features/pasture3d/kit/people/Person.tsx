import { forwardRef, useImperativeHandle, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import { MathUtils } from 'three'
import type { Group } from 'three'
import type { PersonRole, SimulationPerson } from '../../simulation/herdSimulation'
import {
  taperedCylinderGeometry,
  unitBoxGeometry,
  unitCylinderGeometry,
  unitSphereGeometry,
} from '../geometries'
import { materials } from '../materials'

export interface PersonProps {
  person?: SimulationPerson
  position?: [number, number, number]
  heading?: number
  role?: PersonRole
  paused?: boolean
}

export const Person = forwardRef<Group, PersonProps>(function Person(
  {
    person,
    position = [0, 0, 0],
    heading = 0,
    role = 'worker',
    paused = false,
  },
  ref,
) {
  const rootRef = useRef<Group>(null)
  const leftLeg = useRef<Group>(null)
  const rightLeg = useRef<Group>(null)
  const leftArm = useRef<Group>(null)
  const rightArm = useRef<Group>(null)
  const phase = useRef(0)
  const shouldReduceMotion = useReducedMotion()
  const selectedRole = person?.role ?? role
  const worker = selectedRole === 'worker'
  const shirtMaterial = worker ? materials.person.workerShirt : materials.person.visitorShirt
  const pantsMaterial = worker ? materials.person.workerPants : materials.person.visitorPants
  const hatMaterial = worker ? materials.person.workerHat : materials.person.visitorHat
  const rootPosition: [number, number, number] = person
    ? [person.position.x, 0, person.position.z]
    : position

  useImperativeHandle(ref, () => rootRef.current as Group, [])

  useFrame((_, delta) => {
    if (rootRef.current && person) {
      rootRef.current.position.set(person.position.x, 0, person.position.z)
      rootRef.current.rotation.y = -person.heading
    }

    if (paused) return

    if (shouldReduceMotion) {
      if (leftLeg.current) leftLeg.current.rotation.z = 0
      if (rightLeg.current) rightLeg.current.rotation.z = 0
      if (leftArm.current) leftArm.current.rotation.z = 0
      if (rightArm.current) rightArm.current.rotation.z = 0
      return
    }

    phase.current += delta * 5.2
    const swing = Math.sin(phase.current) * 0.3

    if (leftLeg.current) {
      leftLeg.current.rotation.z = MathUtils.damp(leftLeg.current.rotation.z, swing, 12, delta)
    }
    if (rightLeg.current) {
      rightLeg.current.rotation.z = MathUtils.damp(rightLeg.current.rotation.z, -swing, 12, delta)
    }
    if (leftArm.current) {
      leftArm.current.rotation.z = MathUtils.damp(leftArm.current.rotation.z, -swing * 0.72, 12, delta)
    }
    if (rightArm.current) {
      rightArm.current.rotation.z = MathUtils.damp(rightArm.current.rotation.z, swing * 0.72, 12, delta)
    }
  })

  return (
    <group
      ref={rootRef}
      position={rootPosition}
      rotation={[0, person ? -person.heading : -heading, 0]}
    >
      <mesh
        geometry={unitBoxGeometry}
        material={shirtMaterial}
        position={[0, 1.18, 0]}
        scale={[0.3, 0.62, 0.48]}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={unitCylinderGeometry}
        material={materials.person.skin}
        position={[0, 1.51, 0]}
        scale={[0.085, 0.13, 0.085]}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={unitSphereGeometry}
        material={materials.person.skin}
        position={[0, 1.64, 0]}
        scale={[0.16, 0.19, 0.16]}
        castShadow
        receiveShadow
      />

      {worker ? (
        <>
          <mesh
            geometry={unitCylinderGeometry}
            material={hatMaterial}
            position={[0, 1.8, 0]}
            scale={[0.28, 0.035, 0.28]}
            castShadow
            receiveShadow
          />
          <mesh
            geometry={taperedCylinderGeometry}
            material={hatMaterial}
            position={[0, 1.88, 0]}
            scale={[0.17, 0.16, 0.17]}
            castShadow
            receiveShadow
          />
        </>
      ) : (
        <>
          <mesh
            geometry={unitSphereGeometry}
            material={hatMaterial}
            position={[0, 1.79, 0]}
            scale={[0.18, 0.1, 0.17]}
            castShadow
            receiveShadow
          />
          <mesh
            geometry={unitBoxGeometry}
            material={hatMaterial}
            position={[0.15, 1.77, 0]}
            scale={[0.25, 0.035, 0.24]}
            castShadow
            receiveShadow
          />
        </>
      )}

      {[
        { ref: leftLeg, z: 0.13 },
        { ref: rightLeg, z: -0.13 },
      ].map(({ ref: legRef, z }) => (
        <group key={z} ref={legRef} position={[0, 0.88, z]}>
          <mesh
            geometry={taperedCylinderGeometry}
            material={pantsMaterial}
            position={[0, -0.36, 0]}
            scale={[0.1, 0.72, 0.1]}
            castShadow
            receiveShadow
          />
          <mesh
            geometry={unitBoxGeometry}
            material={materials.person.boots}
            position={[0.045, -0.77, 0]}
            scale={[0.25, 0.13, 0.18]}
            castShadow
            receiveShadow
          />
        </group>
      ))}

      {[
        { ref: leftArm, z: 0.3 },
        { ref: rightArm, z: -0.3 },
      ].map(({ ref: armRef, z }) => (
        <group key={z} ref={armRef} position={[0, 1.42, z]}>
          <mesh
            geometry={taperedCylinderGeometry}
            material={shirtMaterial}
            position={[0, -0.25, 0]}
            scale={[0.075, 0.5, 0.075]}
            castShadow
            receiveShadow
          />
          <mesh
            geometry={unitSphereGeometry}
            material={materials.person.skin}
            position={[0, -0.55, 0]}
            scale={[0.08, 0.09, 0.08]}
            castShadow
            receiveShadow
          />
        </group>
      ))}
    </group>
  )
})
