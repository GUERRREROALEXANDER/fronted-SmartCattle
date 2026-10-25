import { forwardRef, useImperativeHandle, useRef } from 'react'
import type { ReactNode, RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import { MathUtils } from 'three'
import type { Group } from 'three'
import type { CowCoat, CowMotionState, SimulationCow } from '../../simulation/herdSimulation'
import {
  taperedCylinderGeometry,
  unitBoxGeometry,
  unitConeGeometry,
  unitSphereGeometry,
} from '../geometries'
import { materials } from '../materials'

export interface CowProps {
  cow?: SimulationCow
  position?: [number, number, number]
  heading?: number
  coat?: CowCoat
  state?: CowMotionState
  paused?: boolean
  children?: ReactNode
}

function moveLeg(group: Group | null, target: number, delta: number) {
  if (group) group.rotation.z = MathUtils.damp(group.rotation.z, target, 11, delta)
}

export const Cow = forwardRef<Group, CowProps>(function Cow(
  {
    cow,
    position = [0, 0, 0],
    heading = 0,
    coat = 'holstein',
    state = 'grazing',
    paused = false,
    children,
  },
  ref,
) {
  const rootRef = useRef<Group>(null)
  const headRef = useRef<Group>(null)
  const frontLeftLeg = useRef<Group>(null)
  const frontRightLeg = useRef<Group>(null)
  const backLeftLeg = useRef<Group>(null)
  const backRightLeg = useRef<Group>(null)
  const phase = useRef(0)
  const shouldReduceMotion = useReducedMotion()
  const selectedCoat = cow?.coat ?? coat
  const coatMaterial = materials.cow[selectedCoat]
  const rootPosition: [number, number, number] = cow
    ? [cow.position.x, 0, cow.position.z]
    : position

  useImperativeHandle(ref, () => rootRef.current as Group, [])

  useFrame((_, delta) => {
    if (rootRef.current && cow) {
      rootRef.current.position.set(cow.position.x, 0, cow.position.z)
      rootRef.current.rotation.y = -cow.heading
    }

    if (paused) return

    const motionState = cow?.state ?? state
    const walking = motionState === 'walking' || motionState === 'returning'

    if (shouldReduceMotion) {
      if (frontLeftLeg.current) frontLeftLeg.current.rotation.z = 0
      if (frontRightLeg.current) frontRightLeg.current.rotation.z = 0
      if (backLeftLeg.current) backLeftLeg.current.rotation.z = 0
      if (backRightLeg.current) backRightLeg.current.rotation.z = 0
      if (headRef.current) headRef.current.rotation.z = motionState === 'grazing' ? -1.02 : -0.08
      return
    }

    if (walking) phase.current += delta * (motionState === 'returning' ? 6.6 : 5.2)
    else phase.current = 0

    const swing = walking ? Math.sin(phase.current) * 0.24 : 0
    moveLeg(frontLeftLeg.current, swing, delta)
    moveLeg(backRightLeg.current, swing, delta)
    moveLeg(frontRightLeg.current, -swing, delta)
    moveLeg(backLeftLeg.current, -swing, delta)

    if (headRef.current) {
      const headTarget = motionState === 'grazing'
        ? -1.02
        : -0.08 + Math.sin(phase.current * 2) * 0.025
      headRef.current.rotation.z = MathUtils.damp(
        headRef.current.rotation.z,
        headTarget,
        8,
        delta,
      )
    }
  })

  const leg = (
    legRef: RefObject<Group | null>,
    x: number,
    z: number,
  ) => (
    <group ref={legRef} position={[x, 1.07, z]}>
      <mesh
        geometry={taperedCylinderGeometry}
        material={coatMaterial}
        position={[0, -0.29, 0]}
        scale={[0.13, 0.58, 0.13]}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={taperedCylinderGeometry}
        material={coatMaterial}
        position={[0, -0.76, 0]}
        scale={[0.09, 0.46, 0.09]}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={unitBoxGeometry}
        material={materials.cow.hoof}
        position={[0.035, -1.015, 0]}
        scale={[0.22, 0.13, 0.2]}
        castShadow
        receiveShadow
      />
    </group>
  )

  return (
    <group
      ref={rootRef}
      position={rootPosition}
      rotation={[0, cow ? -cow.heading : -heading, 0]}
    >
      <mesh
        geometry={unitSphereGeometry}
        material={coatMaterial}
        position={[-0.15, 1.45, 0]}
        scale={[1.2, 0.62, 0.52]}
        castShadow
        receiveShadow
      />

      {selectedCoat === 'holstein' && (
        <>
          {[-1, 1].map((side) => (
            <group key={side}>
              <mesh
                geometry={unitSphereGeometry}
                material={materials.cow.patch}
                position={[-0.55, 1.58, side * 0.47]}
                scale={[0.42, 0.3, 0.055]}
                castShadow
                receiveShadow
              />
              <mesh
                geometry={unitSphereGeometry}
                material={materials.cow.patch}
                position={[0.35, 1.37, side * 0.47]}
                scale={[0.34, 0.27, 0.055]}
                castShadow
                receiveShadow
              />
            </group>
          ))}
          <mesh
            geometry={unitSphereGeometry}
            material={materials.cow.patch}
            position={[-0.25, 2.03, 0.1]}
            scale={[0.34, 0.055, 0.28]}
            castShadow
            receiveShadow
          />
        </>
      )}

      <mesh
        geometry={unitSphereGeometry}
        material={materials.cow.udder}
        position={[-0.42, 0.8, 0]}
        scale={[0.32, 0.2, 0.27]}
        castShadow
        receiveShadow
      />

      <group ref={headRef} position={[0.65, 1.45, 0]}>
        <mesh
          geometry={unitSphereGeometry}
          material={coatMaterial}
          position={[0.2, 0.02, 0]}
          rotation={[0, 0, -0.15]}
          scale={[0.5, 0.44, 0.4]}
          castShadow
          receiveShadow
        />
        <mesh
          geometry={unitSphereGeometry}
          material={coatMaterial}
          position={[0.68, 0, 0]}
          scale={[0.46, 0.33, 0.29]}
          castShadow
          receiveShadow
        />
        <mesh
          geometry={unitSphereGeometry}
          material={materials.cow.muzzle}
          position={[1.04, -0.14, 0]}
          scale={[0.3, 0.22, 0.28]}
          castShadow
          receiveShadow
        />

        {[-1, 1].map((side) => (
          <group key={side}>
            <mesh
              geometry={unitSphereGeometry}
              material={coatMaterial}
              position={[0.48, 0.13, side * 0.34]}
              rotation={[side * 0.25, 0, 0]}
              scale={[0.18, 0.07, 0.2]}
              castShadow
              receiveShadow
            />
            <mesh
              geometry={unitConeGeometry}
              material={materials.cow.horn}
              position={[0.55, 0.29, side * 0.2]}
              rotation={[side * 0.55, 0, 0]}
              scale={[0.065, 0.25, 0.065]}
              castShadow
              receiveShadow
            />
            <mesh
              geometry={unitSphereGeometry}
              material={materials.cow.hoof}
              position={[0.83, 0.08, side * 0.255]}
              scale={[0.035, 0.035, 0.035]}
            />
            <mesh
              geometry={unitSphereGeometry}
              material={materials.cow.hoof}
              position={[1.27, -0.1, side * 0.15]}
              scale={[0.035, 0.025, 0.035]}
            />
          </group>
        ))}
      </group>

      {leg(frontLeftLeg, 0.58, 0.34)}
      {leg(frontRightLeg, 0.58, -0.34)}
      {leg(backLeftLeg, -0.82, 0.34)}
      {leg(backRightLeg, -0.82, -0.34)}

      <mesh
        geometry={taperedCylinderGeometry}
        material={coatMaterial}
        position={[-1.36, 1.13, 0]}
        rotation={[0, 0, -0.28]}
        scale={[0.045, 0.82, 0.045]}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={unitSphereGeometry}
        material={materials.cow.hoof}
        position={[-1.48, 0.68, 0]}
        scale={[0.1, 0.18, 0.1]}
        castShadow
        receiveShadow
      />
      {children}
    </group>
  )
})
