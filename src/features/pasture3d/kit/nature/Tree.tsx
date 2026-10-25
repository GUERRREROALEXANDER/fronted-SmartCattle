import {
  foliageGeometry,
  taperedCylinderGeometry,
  unitConeGeometry,
} from '../geometries'
import { materials } from '../materials'

export type TreeVariant = 'broadleaf' | 'pine'
export type TreeTone = 'dark' | 'mid' | 'light'

export interface TreeProps {
  position?: [number, number, number]
  /** Rotation around the vertical axis, in radians. */
  rotation?: number
  scale?: number
  variant?: TreeVariant
  tone?: TreeTone
}

const foliageByTone = {
  dark: materials.nature.foliageDark,
  mid: materials.nature.foliageMid,
  light: materials.nature.foliageLight,
} as const

type Vec3 = [number, number, number]

const BROADLEAF_CROWN: readonly { position: Vec3; scale: Vec3 }[] = [
  { position: [0, 3.05, 0], scale: [1.55, 1.25, 1.5] },
  { position: [0.72, 2.6, 0.38], scale: [1, 0.85, 0.95] },
  { position: [-0.64, 2.7, -0.32], scale: [0.95, 0.8, 1] },
  { position: [0.1, 3.75, -0.2], scale: [0.9, 0.75, 0.85] },
]

export function Tree({
  position = [0, 0, 0],
  rotation = 0,
  scale = 1,
  variant = 'broadleaf',
  tone = 'mid',
}: TreeProps) {
  const foliage = foliageByTone[tone]

  if (variant === 'pine') {
    return (
      <group position={position} rotation={[0, rotation, 0]} scale={scale}>
        <mesh
          geometry={taperedCylinderGeometry}
          material={materials.nature.trunk}
          position={[0, 0.7, 0]}
          scale={[0.18, 1.4, 0.18]}
          castShadow
          receiveShadow
        />
        {[
          { y: 1.9, radius: 1.45, height: 2 },
          { y: 2.95, radius: 1.12, height: 1.75 },
          { y: 3.9, radius: 0.76, height: 1.45 },
        ].map((tier) => (
          <mesh
            key={tier.y}
            geometry={unitConeGeometry}
            material={foliage}
            position={[0, tier.y, 0]}
            scale={[tier.radius, tier.height, tier.radius]}
            castShadow
            receiveShadow
          />
        ))}
      </group>
    )
  }

  return (
    <group position={position} rotation={[0, rotation, 0]} scale={scale}>
      <mesh
        geometry={taperedCylinderGeometry}
        material={materials.nature.trunk}
        position={[0, 1.1, 0]}
        scale={[0.22, 2.2, 0.22]}
        castShadow
        receiveShadow
      />
      {BROADLEAF_CROWN.map((blob, index) => (
        <mesh
          key={index}
          geometry={foliageGeometry}
          material={foliage}
          position={blob.position}
          scale={blob.scale}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  )
}
