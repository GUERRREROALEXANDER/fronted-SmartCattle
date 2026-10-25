import {
  cameraViewConeGeometry,
  unitBoxGeometry,
  unitCylinderGeometry,
} from '../geometries'
import { materials } from '../materials'

export interface CameraPoleProps {
  position?: [number, number, number]
  heading?: number
  scale?: number
}

export function CameraPole({
  position = [0, 0, 0],
  heading = 0,
  scale = 1,
}: CameraPoleProps) {
  const headingRadians = heading * Math.PI / 180

  return (
    <group position={position} rotation={[0, -headingRadians, 0]} scale={scale}>
      <mesh
        geometry={unitCylinderGeometry}
        material={materials.structure.cameraPole}
        position={[0, 1.6, 0]}
        scale={[0.07, 3.2, 0.07]}
        castShadow
        receiveShadow
      />
      <group position={[0, 3.08, 0]} rotation={[0, 0, -0.16]}>
        <mesh
          geometry={unitBoxGeometry}
          material={materials.structure.cameraBody}
          position={[0.2, 0, 0]}
          scale={[0.5, 0.28, 0.32]}
          castShadow
          receiveShadow
        />
        <mesh
          geometry={unitCylinderGeometry}
          material={materials.structure.cameraLens}
          position={[0.49, 0, 0]}
          rotation={[0, 0, -Math.PI / 2]}
          scale={[0.095, 0.12, 0.095]}
          castShadow
          receiveShadow
        />
        <mesh
          geometry={unitBoxGeometry}
          material={materials.structure.cameraBody}
          position={[0.19, 0.18, 0]}
          scale={[0.62, 0.06, 0.42]}
          castShadow
          receiveShadow
        />
        <mesh
          geometry={cameraViewConeGeometry}
          material={materials.structure.cameraView}
          position={[0.52, 0, 0]}
          renderOrder={1}
        />
      </group>
    </group>
  )
}
