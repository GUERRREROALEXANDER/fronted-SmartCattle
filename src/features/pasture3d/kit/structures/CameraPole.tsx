import { useMemo } from 'react'
import { ConeGeometry } from 'three'
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js'
import { getMaterials } from '../materials'
import { heightAt } from '../terrain/heightfield'

export interface CameraPoleProps {
  position: [number, number, number]
  /** Degrees, 0 = east, 90 = south. */
  heading?: number
}

const housingGeometry = new RoundedBoxGeometry(0.42, 0.2, 0.2, 3, 0.05)
const shieldGeometry = new RoundedBoxGeometry(0.54, 0.03, 0.28, 2, 0.012)
const viewGeometry = new ConeGeometry(1.45, 4.4, 16, 1, true).rotateZ(Math.PI / 2).translate(2.2, 0, 0)

/** Galvanised pole with a weatherproof bullet camera and its small solar panel. */
export function CameraPole({ position, heading = 0 }: CameraPoleProps) {
  const materials = getMaterials().structure
  const radians = (heading * Math.PI) / 180
  const ground = useMemo(() => heightAt(position[0], position[2]), [position])

  return (
    <group position={[position[0], ground, position[2]]} rotation={[0, -radians, 0]}>
      <mesh material={materials.concrete} position={[0, 0.05, 0]} receiveShadow castShadow>
        <cylinderGeometry args={[0.22, 0.26, 0.2, 16]} />
      </mesh>
      <mesh material={materials.galvanized} position={[0, 1.65, 0]} castShadow receiveShadow>
        <cylinderGeometry args={[0.045, 0.06, 3.3, 14]} />
      </mesh>
      <mesh material={materials.cameraBody} position={[0, 1.3, 0.07]} castShadow>
        <boxGeometry args={[0.16, 0.22, 0.08]} />
      </mesh>
      <group position={[0, 3.32, 0]} rotation={[0, 0, Math.PI / 5]}>
        <mesh material={materials.galvanized} position={[0, 0, 0]}>
          <boxGeometry args={[0.02, 0.36, 0.3]} />
        </mesh>
        <mesh material={materials.solar} position={[0.02, 0, 0]} rotation={[0, 0, 0]}>
          <boxGeometry args={[0.02, 0.34, 0.28]} />
        </mesh>
      </group>
      <group position={[0.05, 3.05, 0]} rotation={[0, 0, -0.18]}>
        <mesh material={materials.galvanized} position={[0.08, 0, 0]}>
          <boxGeometry args={[0.18, 0.04, 0.05]} />
        </mesh>
        <mesh geometry={housingGeometry} material={materials.cameraBody} position={[0.3, -0.02, 0]} castShadow />
        <mesh geometry={shieldGeometry} material={materials.cameraBody} position={[0.33, 0.1, 0]} castShadow />
        <mesh material={materials.cameraLens} position={[0.52, -0.02, 0]} rotation={[0, 0, -Math.PI / 2]}>
          <cylinderGeometry args={[0.065, 0.07, 0.04, 20]} />
        </mesh>
        <mesh geometry={viewGeometry} material={materials.cameraView} position={[0.54, -0.02, 0]} renderOrder={1} />
      </group>
    </group>
  )
}
