import { useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useReducedMotion } from 'motion/react'
import {
  BufferGeometry,
  Color,
  Float32BufferAttribute,
  LineBasicMaterial,
  ShapeUtils,
  Vector2,
} from 'three'
import type { WorldPoint } from '../../simulation/geometry'
import { createStandardMaterial, palette } from '../materials'
import { FenceLine } from './FenceLine'

const SAFE_POST_COLOR = new Color(palette.safeInk)
const SAFE_COLOR = new Color(palette.safe)
const CRITICAL_COLOR = new Color(palette.critical)

export interface ZoneFenceLot {
  id: string
  name: string
  boundary: readonly WorldPoint[]
}

export interface ZoneFenceProps {
  lot: ZoneFenceLot
  breached: boolean
  postHeight?: number
}

function cleanBoundary(points: readonly WorldPoint[]) {
  const boundary = points.filter((point, index) => {
    if (index === 0) return true
    const previous = points[index - 1]
    return Math.hypot(point.x - previous.x, point.z - previous.z) > 0.0001
  })

  if (boundary.length > 1) {
    const first = boundary[0]
    const last = boundary[boundary.length - 1]
    if (Math.hypot(first.x - last.x, first.z - last.z) < 0.0001) boundary.pop()
  }

  return boundary
}

function createFillGeometry(boundary: readonly WorldPoint[]) {
  if (boundary.length < 3) return null

  const contour = boundary.map((point) => new Vector2(point.x, point.z))
  const faces = ShapeUtils.triangulateShape(contour, [])
  const indices: number[] = []

  faces.forEach(([a, b, c]) => {
    const pointA = boundary[a]
    const pointB = boundary[b]
    const pointC = boundary[c]
    const area =
      (pointB.x - pointA.x) * (pointC.z - pointA.z) -
      (pointB.z - pointA.z) * (pointC.x - pointA.x)
    if (area > 0) indices.push(a, c, b)
    else indices.push(a, b, c)
  })

  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      boundary.flatMap((point) => [point.x, 0, point.z]),
      3,
    ),
  )
  geometry.setIndex(indices)
  geometry.computeVertexNormals()
  geometry.computeBoundingSphere()
  return geometry
}

function createOutlineGeometry(boundary: readonly WorldPoint[]) {
  if (boundary.length < 2) return null

  const geometry = new BufferGeometry()
  geometry.setAttribute(
    'position',
    new Float32BufferAttribute(
      boundary.flatMap((point) => [point.x, 0, point.z]),
      3,
    ),
  )
  geometry.computeBoundingSphere()
  return geometry
}

export function ZoneFence({ lot, breached, postHeight }: ZoneFenceProps) {
  const shouldReduceMotion = useReducedMotion()
  const boundary = useMemo(() => cleanBoundary(lot.boundary), [lot.boundary])
  const fillGeometry = useMemo(() => createFillGeometry(boundary), [boundary])
  const outlineGeometry = useMemo(() => createOutlineGeometry(boundary), [boundary])
  const postMaterial = useMemo(
    () => createStandardMaterial('safeInk', { roughness: 1 }),
    [],
  )
  const wireMaterial = useMemo(
    () => createStandardMaterial('safe', { roughness: 0.72, metalness: 0.18 }),
    [],
  )
  const fillMaterial = useMemo(
    () => createStandardMaterial('safe', {
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      roughness: 1,
    }),
    [],
  )
  const outlineMaterial = useMemo(
    () => new LineBasicMaterial({
      color: palette.safe,
      transparent: true,
      opacity: 0.24,
      depthWrite: false,
    }),
    [],
  )

  useEffect(() => () => {
    postMaterial.dispose()
    wireMaterial.dispose()
    fillMaterial.dispose()
    outlineMaterial.dispose()
  }, [fillMaterial, outlineMaterial, postMaterial, wireMaterial])

  useEffect(() => () => {
    fillGeometry?.dispose()
    outlineGeometry?.dispose()
  }, [fillGeometry, outlineGeometry])

  useFrame((state, delta) => {
    const colorBlend = 1 - Math.exp(-delta * 7)
    const safePostTarget = breached ? CRITICAL_COLOR : SAFE_POST_COLOR
    const safeTarget = breached ? CRITICAL_COLOR : SAFE_COLOR

    postMaterial.color.lerp(safePostTarget, colorBlend)
    wireMaterial.color.lerp(safeTarget, colorBlend)
    fillMaterial.color.lerp(safeTarget, colorBlend)
    outlineMaterial.color.lerp(safeTarget, colorBlend)

    // setValues keeps the per-frame material update out of React's immutability lint.
    let opacity = 0.24
    if (breached) {
      opacity = shouldReduceMotion ? 0.9 : 0.62 + Math.sin(state.clock.elapsedTime * 3.4) * 0.3
    }
    outlineMaterial.setValues({ opacity })
    fillMaterial.setValues({ opacity: breached ? 0.2 : 0.13 })
  })

  return (
    <group name={`zone-${lot.id}`} userData={{ lotName: lot.name }}>
      {fillGeometry && (
        <mesh
          geometry={fillGeometry}
          material={fillMaterial}
          position={[0, 0.006, 0]}
          renderOrder={1}
        />
      )}
      {outlineGeometry && (
        <lineLoop
          geometry={outlineGeometry}
          material={outlineMaterial}
          position={[0, 0.045, 0]}
          renderOrder={2}
        />
      )}
      <FenceLine
        points={boundary}
        closed
        postHeight={postHeight}
        postMaterial={postMaterial}
        wireMaterial={wireMaterial}
      />
    </group>
  )
}
