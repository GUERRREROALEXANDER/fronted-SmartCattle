import { unitBoxGeometry } from '../geometries'
import { materials } from '../materials'

export interface WaterTroughProps {
  position?: [number, number, number]
  heading?: number
  scale?: number
}

export function WaterTrough({
  position = [0, 0, 0],
  heading = 0,
  scale = 1,
}: WaterTroughProps) {
  return (
    <group position={position} rotation={[0, -heading, 0]} scale={scale}>
      <mesh
        geometry={unitBoxGeometry}
        material={materials.structure.trough}
        position={[0, 0.14, 0]}
        scale={[2, 0.16, 0.82]}
        castShadow
        receiveShadow
      />
      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh
            geometry={unitBoxGeometry}
            material={materials.structure.trough}
            position={[0, 0.38, side * 0.43]}
            scale={[2.1, 0.55, 0.1]}
            castShadow
            receiveShadow
          />
          <mesh
            geometry={unitBoxGeometry}
            material={materials.structure.trough}
            position={[side, 0.38, 0]}
            scale={[0.1, 0.55, 0.75]}
            castShadow
            receiveShadow
          />
        </group>
      ))}
      {[-0.78, 0.78].flatMap((x) => [-0.28, 0.28].map((z) => (
        <mesh
          key={`${x}-${z}`}
          geometry={unitBoxGeometry}
          material={materials.structure.trough}
          position={[x, 0.06, z]}
          scale={[0.12, 0.12, 0.12]}
          castShadow
          receiveShadow
        />
      )))}
      <mesh
        geometry={unitBoxGeometry}
        material={materials.structure.water}
        position={[0, 0.47, 0]}
        scale={[1.82, 0.025, 0.62]}
        renderOrder={1}
        receiveShadow
      />
    </group>
  )
}
