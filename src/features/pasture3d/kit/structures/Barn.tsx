import { barnGableGeometry, unitBoxGeometry } from '../geometries'
import { materials } from '../materials'

const ROOF_ANGLE = Math.atan2(1.2, 2.15)
const ROOF_PANEL_LENGTH = Math.hypot(1.2, 2.15)

export interface BarnProps {
  position?: [number, number, number]
  heading?: number
  scale?: number
}

export function Barn({ position = [0, 0, 0], heading = 0, scale = 1 }: BarnProps) {
  return (
    <group position={position} rotation={[0, -heading, 0]} scale={scale}>
      <mesh
        geometry={unitBoxGeometry}
        material={materials.structure.barnWall}
        position={[0, 1.175, 0]}
        scale={[5.4, 2.35, 4]}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={barnGableGeometry}
        material={materials.structure.barnWall}
        position={[2.7, 0, 0]}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={barnGableGeometry}
        material={materials.structure.barnWall}
        position={[-2.7, 0, 0]}
        rotation={[0, Math.PI, 0]}
        castShadow
        receiveShadow
      />

      {[-1, 1].map((side) => (
        <mesh
          key={side}
          geometry={unitBoxGeometry}
          material={materials.structure.barnRoof}
          position={[0, 2.95, side * 1.075]}
          rotation={[side * ROOF_ANGLE, 0, 0]}
          scale={[5.85, 0.16, ROOF_PANEL_LENGTH]}
          castShadow
          receiveShadow
        />
      ))}

      <mesh
        geometry={unitBoxGeometry}
        material={materials.structure.barnDoor}
        position={[2.735, 0.9, 0]}
        scale={[0.06, 1.8, 1.5]}
        castShadow
        receiveShadow
      />
      <mesh
        geometry={unitBoxGeometry}
        material={materials.structure.barnTrim}
        position={[2.775, 0.9, 0]}
        scale={[0.035, 1.8, 0.045]}
        castShadow
        receiveShadow
      />
      {[0.45, 1.35].map((height) => (
        <mesh
          key={height}
          geometry={unitBoxGeometry}
          material={materials.structure.barnTrim}
          position={[2.775, height, 0]}
          scale={[0.035, 0.055, 1.5]}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  )
}
