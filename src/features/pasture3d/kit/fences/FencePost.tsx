import type { MeshStandardMaterial } from 'three'
import { fencePostGeometry } from '../geometries'
import { materials } from '../materials'

export const FENCE_POST_HEIGHT = 1.25

export interface FencePostProps {
  position?: [number, number, number]
  height?: number
  material?: MeshStandardMaterial
}

export function FencePost({
  position = [0, 0, 0],
  height = FENCE_POST_HEIGHT,
  material = materials.fence.post,
}: FencePostProps) {
  return (
    <mesh
      geometry={fencePostGeometry}
      material={material}
      position={[position[0], position[1] + height / 2, position[2]]}
      scale={[1, height, 1]}
      castShadow
      receiveShadow
    />
  )
}
