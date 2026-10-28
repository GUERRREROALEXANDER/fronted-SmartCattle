import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  Color,
  Euler,
  Float32BufferAttribute,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  Quaternion,
  Vector3,
} from 'three'
import { mulberry32, randomRange } from '../../simulation/rng'
import { getMaterials } from '../materials'
import { fbm2, noise2 } from '../noise'
import { heightAt } from '../terrain/heightfield'

export interface RockPlacement {
  position: [number, number, number]
  seed: number
  count: number
}

function rockGeometry() {
  const geometry = new IcosahedronGeometry(1, 4)
  const position = geometry.getAttribute('position')
  const colors = new Float32Array(position.count * 3)
  const base = new Color('#8b8679')
  const dark = new Color('#4e4a42')
  const lichen = new Color('#9a9a62')
  const color = new Color()
  const v = new Vector3()
  for (let k = 0; k < position.count; k += 1) {
    v.fromBufferAttribute(position, k)
    const n = fbm2(v.x * 1.6 + v.z, v.y * 1.6 - v.z * 0.7)
    // Faceted strata plus lumps: flatter top, broader base.
    const radius = 0.78 + n * 0.45 + Math.abs(noise2(v.x * 5, v.z * 5)) * 0.06
    v.multiplyScalar(radius)
    v.y *= v.y > 0 ? 0.62 : 0.4
    position.setXYZ(k, v.x, v.y, v.z)
    color.copy(base).lerp(dark, Math.max(0, -v.y * 1.4) + noise2(v.x * 6, v.z * 6) * 0.25)
    if (v.y > 0.15) color.lerp(lichen, Math.max(0, noise2(v.x * 4 + 3, v.z * 4) - 0.55) * 1.6)
    colors.set([color.r, color.g, color.b], k * 3)
  }
  geometry.setAttribute('color', new Float32BufferAttribute(colors, 3))
  geometry.computeVertexNormals()
  return geometry
}

export function Rocks({ clusters }: { clusters: readonly RockPlacement[] }) {
  const geometry = useMemo(() => rockGeometry(), [])
  const meshRef = useRef<InstancedMesh>(null)
  const rocks = useMemo(() => clusters.flatMap(cluster => {
    const rng = mulberry32(cluster.seed)
    return Array.from({ length: Math.max(1, cluster.count) }, (_, index) => {
      const size = index === 0 ? randomRange(rng, 0.45, 0.85) : randomRange(rng, 0.15, 0.42)
      const angle = rng() * Math.PI * 2
      const distance = index === 0 ? 0 : randomRange(rng, 0.5, 1.2)
      const x = cluster.position[0] + Math.cos(angle) * distance
      const z = cluster.position[2] + Math.sin(angle) * distance
      return {
        position: new Vector3(x, heightAt(x, z) + size * 0.08, z),
        rotation: new Euler(rng() * 0.3, rng() * Math.PI * 2, rng() * 0.3),
        scale: new Vector3(size * randomRange(rng, 0.9, 1.4), size, size * randomRange(rng, 0.8, 1.1)),
      }
    })
  }), [clusters])

  useEffect(() => () => geometry.dispose(), [geometry])

  useLayoutEffect(() => {
    const matrix = new Matrix4()
    const quaternion = new Quaternion()
    rocks.forEach((rock, index) => {
      meshRef.current?.setMatrixAt(index, matrix.compose(rock.position, quaternion.setFromEuler(rock.rotation), rock.scale))
    })
    if (meshRef.current) {
      meshRef.current.instanceMatrix.needsUpdate = true
      meshRef.current.computeBoundingSphere()
    }
  }, [rocks])

  if (rocks.length === 0) return null
  return <instancedMesh ref={meshRef} args={[geometry, getMaterials().nature.rock, rocks.length]} castShadow receiveShadow />
}
