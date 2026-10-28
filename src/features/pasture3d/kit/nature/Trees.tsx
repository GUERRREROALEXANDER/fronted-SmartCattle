import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import {
  BufferGeometry,
  Color,
  CylinderGeometry,
  IcosahedronGeometry,
  InstancedMesh,
  Matrix4,
  MeshDepthMaterial,
  PlaneGeometry,
  Quaternion,
  RGBADepthPacking,
  Vector3,
} from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { mulberry32 } from '../../simulation/rng'
import { getMaterials } from '../materials'
import { hash2 } from '../noise'
import { heightAt } from '../terrain/heightfield'

export type TreeVariant = 'broadleaf' | 'pine'
export type TreeTone = 'dark' | 'mid' | 'light'

export interface TreePlacement {
  position: [number, number, number]
  rotation: number
  scale: number
  variant: TreeVariant
  tone: TreeTone
}

interface CrownShape {
  center: Vector3
  /** Ellipsoid radii for broadleaf, or [base radius, height, -] for a cone. */
  radii: Vector3
  cone: boolean
}

const UP = new Vector3(0, 1, 0)

function branch(from: Vector3, to: Vector3, r0: number, r1: number) {
  const length = from.distanceTo(to)
  const geometry = new CylinderGeometry(r1, r0, length, 7, 3)
  geometry.translate(0, length / 2, 0)
  const direction = to.clone().sub(from).normalize()
  geometry.applyQuaternion(new Quaternion().setFromUnitVectors(UP, direction))
  geometry.translate(from.x, from.y, from.z)
  return geometry
}

function trunkGeometry(variant: TreeVariant) {
  const parts: BufferGeometry[] = []
  if (variant === 'pine') {
    parts.push(branch(new Vector3(0, -0.3, 0), new Vector3(0, 6.5, 0), 0.24, 0.05))
  } else {
    const fork = new Vector3(0.1, 2.6, 0)
    parts.push(branch(new Vector3(0, -0.3, 0), fork, 0.34, 0.24))
    const rng = mulberry32(5)
    for (let k = 0; k < 4; k += 1) {
      const angle = (k / 4) * Math.PI * 2 + rng() * 0.6
      const tip = new Vector3(Math.cos(angle) * 2.1, 4.4 + rng() * 0.6, Math.sin(angle) * 2.1)
      parts.push(branch(fork, tip, 0.17, 0.05))
    }
  }
  // Root flare
  const flare = new CylinderGeometry(0.3, variant === 'pine' ? 0.42 : 0.62, 0.5, 9)
  flare.translate(0, 0.05, 0)
  parts.push(flare)
  const merged = mergeGeometries(parts.map(part => part.toNonIndexed()))
  parts.forEach(part => part.dispose())
  merged.computeVertexNormals()
  return merged
}

function crownShape(variant: TreeVariant): CrownShape {
  return variant === 'pine'
    ? { center: new Vector3(0, 1.4, 0), radii: new Vector3(2.0, 7.4, 0), cone: true }
    : { center: new Vector3(0, 4.9, 0), radii: new Vector3(3.3, 1.75, 3.3), cone: false }
}

/** Point on the crown surface for parameters u, v in 0..1, and its outward normal. */
function crownPoint(shape: CrownShape, u: number, v: number, inset: number) {
  const angle = u * Math.PI * 2
  if (shape.cone) {
    const h = v * shape.radii.y
    const radius = shape.radii.x * (1 - v) * inset
    const point = new Vector3(Math.cos(angle) * radius, shape.center.y + h, Math.sin(angle) * radius)
    const normal = new Vector3(Math.cos(angle), shape.radii.x / shape.radii.y + 0.3, Math.sin(angle)).normalize()
    return { point, normal }
  }
  const polar = Math.acos(1 - v * 1.65)
  const direction = new Vector3(Math.sin(polar) * Math.cos(angle), Math.cos(polar), Math.sin(polar) * Math.sin(angle))
  const point = direction.clone().multiply(shape.radii).multiplyScalar(inset).add(shape.center)
  const normal = direction.clone().divide(shape.radii).normalize()
  return { point, normal }
}

function leafCardsGeometry(variant: TreeVariant) {
  const shape = crownShape(variant)
  const rng = mulberry32(variant === 'pine' ? 17 : 29)
  const cards: BufferGeometry[] = []
  const count = variant === 'pine' ? 90 : 120
  for (let index = 0; index < count; index += 1) {
    const { point, normal } = crownPoint(shape, rng(), rng(), 0.72 + rng() * 0.35)
    const size = variant === 'pine' ? 1.1 + rng() * 0.6 : 1.5 + rng() * 0.9
    const card = new PlaneGeometry(size, size * (variant === 'pine' ? 1.3 : 1))
    card.rotateZ(rng() * Math.PI)
    card.rotateY(rng() * Math.PI)
    card.rotateX((rng() - 0.5) * 1.2)
    card.translate(point.x, point.y, point.z)
    // Volume shading: every vertex gets the crown's outward normal, softened toward the sky.
    const shaded = normal.clone().lerp(UP, 0.25).normalize()
    const normals = card.getAttribute('normal')
    for (let k = 0; k < normals.count; k += 1) normals.setXYZ(k, shaded.x, shaded.y, shaded.z)
    cards.push(card)
  }
  const merged = mergeGeometries(cards)
  cards.forEach(card => card.dispose())
  return merged
}

function coreGeometry(variant: TreeVariant) {
  const shape = crownShape(variant)
  const geometry = variant === 'pine'
    ? new CylinderGeometry(0.1, shape.radii.x * 0.62, shape.radii.y * 0.9, 9, 4).translate(0, shape.center.y + shape.radii.y * 0.45, 0)
    : new IcosahedronGeometry(1, 3)
  if (variant !== 'pine') {
    const position = geometry.getAttribute('position')
    for (let k = 0; k < position.count; k += 1) {
      const lump = 0.86 + hash2(position.getX(k) * 2.7, position.getY(k) * 3.1 + position.getZ(k)) * 0.2
      position.setXYZ(
        k,
        position.getX(k) * shape.radii.x * 0.78 * lump,
        position.getY(k) * shape.radii.y * 0.72 * lump + shape.center.y,
        position.getZ(k) * shape.radii.z * 0.78 * lump,
      )
    }
    geometry.computeVertexNormals()
  }
  return geometry
}

const TONES: Record<TreeTone, Color> = {
  dark: new Color(0.62, 0.7, 0.58),
  mid: new Color(0.86, 0.9, 0.78),
  light: new Color(1.05, 1.05, 0.86),
}
const PINE_TINT = new Color(0.55, 0.68, 0.6)

function TreeVariantMeshes({ trees, variant }: { trees: readonly TreePlacement[]; variant: TreeVariant }) {
  const materials = getMaterials().nature
  const geometries = useMemo(() => ({
    trunk: trunkGeometry(variant),
    cards: leafCardsGeometry(variant),
    core: coreGeometry(variant),
  }), [variant])
  const depthMaterial = useMemo(() => new MeshDepthMaterial({
    depthPacking: RGBADepthPacking,
    map: materials.leaves.map,
    alphaTest: 0.45,
  }), [materials.leaves.map])
  const trunkRef = useRef<InstancedMesh>(null)
  const cardsRef = useRef<InstancedMesh>(null)
  const coreRef = useRef<InstancedMesh>(null)

  useEffect(() => () => {
    geometries.trunk.dispose()
    geometries.cards.dispose()
    geometries.core.dispose()
    depthMaterial.dispose()
  }, [depthMaterial, geometries])

  useLayoutEffect(() => {
    const matrix = new Matrix4()
    const rotation = new Quaternion()
    const position = new Vector3()
    const scale = new Vector3()
    const color = new Color()
    trees.forEach((tree, index) => {
      const [x, , z] = tree.position
      rotation.setFromAxisAngle(UP, tree.rotation)
      matrix.compose(position.set(x, heightAt(x, z), z), rotation, scale.setScalar(tree.scale))
      trunkRef.current?.setMatrixAt(index, matrix)
      cardsRef.current?.setMatrixAt(index, matrix)
      coreRef.current?.setMatrixAt(index, matrix)
      color.copy(TONES[tree.tone])
      if (variant === 'pine') color.multiply(PINE_TINT)
      cardsRef.current?.setColorAt(index, color)
      coreRef.current?.setColorAt(index, color)
    })
    for (const mesh of [trunkRef.current, cardsRef.current, coreRef.current]) {
      if (!mesh) continue
      mesh.instanceMatrix.needsUpdate = true
      if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true
      mesh.computeBoundingSphere()
    }
  }, [trees, variant])

  if (trees.length === 0) return null
  return (
    <group>
      <instancedMesh ref={trunkRef} args={[geometries.trunk, materials.bark, trees.length]} castShadow receiveShadow />
      <instancedMesh ref={coreRef} args={[geometries.core, materials.foliageCore, trees.length]} castShadow receiveShadow />
      <instancedMesh
        ref={cardsRef}
        args={[geometries.cards, materials.leaves, trees.length]}
        customDepthMaterial={depthMaterial}
        castShadow
        receiveShadow
      />
    </group>
  )
}

export function Trees({ trees }: { trees: readonly TreePlacement[] }) {
  const broadleaf = useMemo(() => trees.filter(tree => tree.variant === 'broadleaf'), [trees])
  const pine = useMemo(() => trees.filter(tree => tree.variant === 'pine'), [trees])
  return (
    <>
      <TreeVariantMeshes trees={broadleaf} variant="broadleaf" />
      <TreeVariantMeshes trees={pine} variant="pine" />
    </>
  )
}
