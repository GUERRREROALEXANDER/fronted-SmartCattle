import {
  Color,
  DoubleSide,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
} from 'three'
import {
  barkTexture,
  concreteTexture,
  corrugatedTexture,
  leafTexture,
  plankTexture,
  roadTexture,
  turfTexture,
  woodTexture,
} from './textures'

export const palette = {
  critical: '#B42318',
  criticalGlow: '#FF2A1A',
  fog: '#C9D6DC',
} as const

export const ALERT_COLOR = new Color(palette.criticalGlow)

let cached: ReturnType<typeof createMaterials> | null = null

function createMaterials() {
  const wood = woodTexture()
  const planks = plankTexture()
  const zinc = corrugatedTexture()
  const concrete = concreteTexture()
  const bark = barkTexture()
  bark.repeat.set(2, 3)

  return {
    terrain: {
      ground: new MeshStandardMaterial({ map: turfTexture(), vertexColors: true, roughness: 0.96, metalness: 0 }),
      road: new MeshStandardMaterial({
        map: roadTexture(),
        transparent: true,
        depthWrite: false,
        roughness: 1,
        polygonOffset: true,
        polygonOffsetFactor: -2,
        polygonOffsetUnits: -2,
      }),
    },
    fence: {
      wood: new MeshStandardMaterial({ map: wood, bumpMap: wood, bumpScale: 1.4, roughness: 0.92, metalness: 0 }),
      wire: new MeshStandardMaterial({ color: '#7a7f84', metalness: 0.85, roughness: 0.42 }),
    },
    structure: {
      planks: new MeshStandardMaterial({ map: planks, bumpMap: planks, bumpScale: 1.2, roughness: 0.85 }),
      zinc: new MeshStandardMaterial({
        map: zinc,
        bumpMap: zinc,
        bumpScale: 3,
        metalness: 0.65,
        roughness: 0.42,
        side: DoubleSide,
      }),
      trim: new MeshStandardMaterial({ color: '#ece6d8', roughness: 0.6 }),
      concrete: new MeshStandardMaterial({ map: concrete, bumpMap: concrete, bumpScale: 0.6, roughness: 0.95 }),
      darkWood: new MeshStandardMaterial({ map: wood, color: '#6b5440', roughness: 0.9 }),
      interior: new MeshStandardMaterial({ color: '#16120e', roughness: 1 }),
      water: new MeshPhysicalMaterial({
        color: '#2c4a48',
        roughness: 0.04,
        metalness: 0,
        ior: 1.33,
        envMapIntensity: 1.5,
        clearcoat: 1,
        clearcoatRoughness: 0.02,
      }),
      galvanized: new MeshStandardMaterial({ color: '#b8bfc3', metalness: 0.9, roughness: 0.3 }),
      cameraBody: new MeshPhysicalMaterial({ color: '#f1f2ef', roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
      cameraLens: new MeshPhysicalMaterial({ color: '#0b0d10', roughness: 0.05, metalness: 0.2, clearcoat: 1 }),
      solar: new MeshPhysicalMaterial({ color: '#1b2a4a', roughness: 0.18, metalness: 0.4, clearcoat: 1, clearcoatRoughness: 0.05 }),
      cameraView: new MeshStandardMaterial({
        color: '#7fd1a0',
        transparent: true,
        opacity: 0.06,
        depthWrite: false,
        side: DoubleSide,
        roughness: 1,
      }),
    },
    nature: {
      bark: new MeshStandardMaterial({ map: bark, bumpMap: bark, bumpScale: 2, roughness: 0.95 }),
      leaves: new MeshStandardMaterial({
        map: leafTexture(),
        alphaTest: 0.45,
        side: DoubleSide,
        roughness: 0.82,
        metalness: 0,
      }),
      foliageCore: new MeshStandardMaterial({ color: '#2a4522', roughness: 1 }),
      rock: new MeshStandardMaterial({ vertexColors: true, roughness: 0.88, metalness: 0 }),
    },
  }
}

export function getMaterials() {
  cached ??= createMaterials()
  return cached
}
