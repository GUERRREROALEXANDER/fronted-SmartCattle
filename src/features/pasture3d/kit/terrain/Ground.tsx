import { useMemo } from 'react'
import { BufferGeometry, Float32BufferAttribute } from 'three'
import { materials } from '../materials'

export interface GroundProps {
  size?: number
  segments?: number
}

export function Ground({ size = 160, segments = 36 }: GroundProps) {
  const geometry = useMemo(() => {
    const subdivisions = Math.max(1, Math.floor(segments))
    const rowSize = subdivisions + 1
    const positions = new Float32Array(rowSize * rowSize * 3)
    const indices: number[] = []

    for (let zIndex = 0; zIndex < rowSize; zIndex += 1) {
      for (let xIndex = 0; xIndex < rowSize; xIndex += 1) {
        const x = (xIndex / subdivisions - 0.5) * size
        const z = (zIndex / subdivisions - 0.5) * size
        const noise =
          Math.sin(x * 0.19 + z * 0.07) * 0.018 +
          Math.cos(z * 0.23 - x * 0.05) * 0.014 +
          Math.sin((x + z) * 0.11) * 0.01
        const offset = (zIndex * rowSize + xIndex) * 3

        positions[offset] = x
        positions[offset + 1] = -0.12 + noise
        positions[offset + 2] = z
      }
    }

    for (let zIndex = 0; zIndex < subdivisions; zIndex += 1) {
      for (let xIndex = 0; xIndex < subdivisions; xIndex += 1) {
        const a = zIndex * rowSize + xIndex
        const b = a + 1
        const c = a + rowSize
        const d = c + 1
        indices.push(a, c, b, b, c, d)
      }
    }

    const groundGeometry = new BufferGeometry()
    groundGeometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
    groundGeometry.setIndex(indices)
    groundGeometry.computeVertexNormals()
    groundGeometry.computeBoundingSphere()
    return groundGeometry
  }, [segments, size])

  return (
    <mesh
      geometry={geometry}
      material={materials.terrain.grass}
      receiveShadow
    />
  )
}
