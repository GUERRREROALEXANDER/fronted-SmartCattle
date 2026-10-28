import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  BufferGeometry,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshLambertMaterial,
  Quaternion,
  ShaderChunk,
  Vector3,
} from 'three'
import { distanceToPolygonBoundary, pointInPolygon, type WorldPoint } from '../../simulation/geometry'
import { mulberry32 } from '../../simulation/rng'
import { noise2 } from '../noise'
import { heightAt } from '../terrain/heightfield'
import { distanceToPolyline } from '../terrain/paths'

export interface GrassProps {
  lots: readonly { boundary: readonly WorldPoint[] }[]
  track: readonly WorldPoint[]
  /** Circles kept clear of grass (barn, trough). */
  clearings: readonly { x: number; z: number; radius: number }[]
  count?: number
  windy: boolean
}

/** Three crossed blades, each two segments plus a tip, curved forward. */
function tuftGeometry() {
  const positions: number[] = []
  const indices: number[] = []
  for (let blade = 0; blade < 3; blade += 1) {
    const angle = (blade / 3) * Math.PI + 0.3
    const lean = 1.2 + blade * 0.5
    const ox = Math.cos(angle + 1.3) * 0.8
    const oz = Math.sin(angle + 1.3) * 0.8
    const base = positions.length / 3
    for (const [y, width] of [[0, 1], [0.5, 0.7]] as const) {
      for (const side of [-1, 1]) {
        const w = width * 0.5 * side
        positions.push(ox + Math.cos(angle) * w + lean * y * y, y, oz + Math.sin(angle) * w + lean * y * y * 0.4)
      }
    }
    positions.push(ox + lean, 1, oz + lean * 0.4)
    indices.push(base, base + 1, base + 2, base + 1, base + 3, base + 2, base + 2, base + 3, base + 4)
  }
  const geometry = new BufferGeometry()
  geometry.setAttribute('position', new Float32BufferAttribute(positions, 3))
  geometry.setAttribute('normal', new Float32BufferAttribute(new Array(positions.length / 3).fill([0, 1, 0]).flat(), 3))
  geometry.setIndex(indices)
  return geometry
}

function grassMaterial(uniforms: { uTime: { value: number }; uWind: { value: number } }) {
  const material = new MeshLambertMaterial({ color: 0xffffff, side: DoubleSide })
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;\nuniform float uWind;\nvarying float vH;')
      .replace(
        '#include <project_vertex>',
        /* glsl */ `
        vec4 mvPosition = vec4(transformed, 1.0);
        #ifdef USE_INSTANCING
          mvPosition = instanceMatrix * mvPosition;
          float bladeH = length(instanceMatrix[1].xyz);
        #else
          float bladeH = 0.2;
        #endif
        vH = position.y;
        float ph = mvPosition.x * 0.45 + mvPosition.z * 0.3;
        float gust = 0.5 + 0.5 * sin(uTime * 0.55 - mvPosition.x * 0.12 - mvPosition.z * 0.07);
        float sway = sin(uTime * 1.9 + ph) * 0.65 + sin(uTime * 3.3 + ph * 1.9) * 0.2;
        float bend = position.y * position.y * bladeH;
        mvPosition.xz += vec2(0.8, 0.55) * (sway * (0.35 + 0.65 * gust) + gust * 0.6) * bend * 0.35 * uWind;
        mvPosition = modelViewMatrix * mvPosition;
        gl_Position = projectionMatrix * mvPosition;`,
      )
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nvarying float vH;')
      .replace('#include <color_fragment>', '#include <color_fragment>\ndiffuseColor.rgb *= mix(0.45, 1.1, vH);')
      .replace(
        '#include <normal_fragment_begin>',
        ShaderChunk.normal_fragment_begin.replace('normal *= faceDirection;', ''),
      )
  }
  material.customProgramCacheKey = () => 'pasture-grass'
  return material
}

const GREENS = ['#557f34', '#5f8a3a', '#6b9142', '#476f30', '#7a9a4a', '#8a9e55'].map(hex => new Color(hex))
const STRAW = new Color('#b9aa5a')
/** One meadow per scene, so the wind clock can live at module scope. */
const windUniforms = { uTime: { value: 0 }, uWind: { value: 1 } }

export function Grass({ lots, track, clearings, count = 42_000, windy }: GrassProps) {
  const geometry = useMemo(() => tuftGeometry(), [])
  const material = useMemo(() => grassMaterial(windUniforms), [])
  const meshRef = useRef<InstancedMesh>(null)

  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  useEffect(() => {
    const mesh = meshRef.current
    if (!mesh) return
    const rng = mulberry32(42)
    const matrix = new Matrix4()
    const rotation = new Quaternion()
    const position = new Vector3()
    const scale = new Vector3()
    const color = new Color()
    const up = new Vector3(0, 1, 0)
    let placed = 0

    for (let attempt = 0; attempt < count * 3 && placed < count; attempt += 1) {
      const x = (rng() - 0.5) * 120
      const z = (rng() - 0.5) * 84
      if (distanceToPolyline({ x, z }, track) < 1.25) continue
      if (clearings.some(c => Math.hypot(x - c.x, z - c.z) < c.radius)) continue
      let inside = false
      let edge = 99
      for (const lot of lots) {
        const d = distanceToPolygonBoundary({ x, z }, lot.boundary)
        if (pointInPolygon({ x, z }, lot.boundary)) inside = true
        edge = Math.min(edge, d)
      }
      // Patchy cover: thin out where the noise says "bare", keep fence lines rank and tall.
      const patch = noise2(x * 0.22, z * 0.22)
      if (rng() > 0.35 + patch * 0.8) continue
      const nearFence = edge < 0.5
      const height = inside && !nearFence
        ? 0.07 + rng() * 0.09
        : (0.2 + rng() * 0.25) * (nearFence ? 1.4 : 1)
      const width = 0.018 + rng() * 0.014
      rotation.setFromAxisAngle(up, rng() * Math.PI * 2)
      mesh.setMatrixAt(placed, matrix.compose(position.set(x, heightAt(x, z) - 0.01, z), rotation, scale.set(width, height, width)))
      color.copy(GREENS[Math.floor(rng() * GREENS.length)])
      if (rng() < (inside ? 0.12 : 0.22)) color.lerp(STRAW, 0.5 + rng() * 0.4)
      color.multiplyScalar(0.8 + noise2(x * 0.7, z * 0.7) * 0.35)
      mesh.setColorAt(placed, color)
      placed += 1
    }
    mesh.count = placed
    mesh.instanceMatrix.needsUpdate = true
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
  }, [clearings, count, lots, track])

  useFrame((_, delta) => {
    windUniforms.uWind.value = windy ? 1 : 0
    if (windy) windUniforms.uTime.value += delta
  })

  return (
    <instancedMesh
      ref={meshRef}
      args={[geometry, material, count]}
      receiveShadow
      frustumCulled={false}
    />
  )
}
