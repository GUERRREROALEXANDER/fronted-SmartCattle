import { DoubleSide, MeshStandardMaterial } from 'three'
import type { MeshStandardMaterialParameters } from 'three'

export const palette = {
  ground: '#EDECE6',
  surface: '#F8F7F3',
  surfaceRaised: '#FFFFFF',
  rule: '#D5D3CA',
  ruleStrong: '#B9B6AA',
  ink: '#17201A',
  inkMuted: '#465049',
  inkSubtle: '#5B645C',
  brand: '#2F4A36',
  brandStrong: '#22362A',
  brandHover: '#3A5A42',
  onBrand: '#F3F1EA',
  onBrandMuted: '#B9C8B7',
  earth: '#8A6A4A',
  earthSurface: '#EFE6DA',
  earthInk: '#6B5037',
  sage: '#7C9A6E',
  safe: '#2E7D4F',
  safeInk: '#23623F',
  safeSurface: '#E2EEE5',
  critical: '#B42318',
  inactive: '#6F756F',
  inactiveSurface: '#E4E4DE',
  stageRaised: '#1C211E',
  stageInkMuted: '#A9B1A9',
  overlayCattle: '#F1EBD8',
} as const

export type PaletteKey = keyof typeof palette
export type StandardMaterialOptions = Omit<
  MeshStandardMaterialParameters,
  'color' | 'flatShading'
>

export function createStandardMaterial(
  color: PaletteKey,
  options: StandardMaterialOptions = {},
) {
  return new MeshStandardMaterial({
    ...options,
    color: palette[color],
    flatShading: true,
    roughness: options.roughness ?? 0.88,
    metalness: options.metalness ?? 0,
  })
}

export const materials = {
  terrain: {
    grass: createStandardMaterial('sage', { roughness: 1 }),
    track: createStandardMaterial('earth', { roughness: 1 }),
  },
  fence: {
    post: createStandardMaterial('earthInk', { roughness: 1 }),
    wire: createStandardMaterial('inkMuted', { roughness: 0.72, metalness: 0.18 }),
  },
  cow: {
    holstein: createStandardMaterial('overlayCattle'),
    brown: createStandardMaterial('earth'),
    black: createStandardMaterial('ink'),
    cream: createStandardMaterial('earthSurface'),
    patch: createStandardMaterial('ink'),
    muzzle: createStandardMaterial('ruleStrong'),
    hoof: createStandardMaterial('ink'),
    horn: createStandardMaterial('onBrandMuted'),
    udder: createStandardMaterial('earthSurface'),
  },
  person: {
    workerShirt: createStandardMaterial('brand'),
    visitorShirt: createStandardMaterial('inactive'),
    workerPants: createStandardMaterial('brandStrong'),
    visitorPants: createStandardMaterial('inkMuted'),
    skin: createStandardMaterial('earth'),
    workerHat: createStandardMaterial('earthSurface'),
    visitorHat: createStandardMaterial('inkSubtle'),
    boots: createStandardMaterial('ink'),
  },
  structure: {
    barnWall: createStandardMaterial('earth'),
    barnRoof: createStandardMaterial('brandStrong'),
    barnDoor: createStandardMaterial('earthInk'),
    barnTrim: createStandardMaterial('earthSurface'),
    trough: createStandardMaterial('inactive', { roughness: 0.62, metalness: 0.28 }),
    water: createStandardMaterial('stageInkMuted', {
      transparent: true,
      opacity: 0.68,
      depthWrite: false,
      roughness: 0.24,
      metalness: 0.08,
    }),
    cameraPole: createStandardMaterial('inkMuted', { metalness: 0.32 }),
    cameraBody: createStandardMaterial('stageRaised', { metalness: 0.2 }),
    cameraLens: createStandardMaterial('ink', { roughness: 0.32 }),
    cameraView: createStandardMaterial('safe', {
      transparent: true,
      opacity: 0.07,
      depthWrite: false,
      side: DoubleSide,
      roughness: 1,
    }),
  },
  nature: {
    trunk: createStandardMaterial('earthInk', { roughness: 1 }),
    foliageDark: createStandardMaterial('safeInk', { roughness: 1 }),
    foliageMid: createStandardMaterial('brandHover', { roughness: 1 }),
    foliageLight: createStandardMaterial('sage', { roughness: 1 }),
    rock: createStandardMaterial('inactive', { roughness: 1 }),
    rockLight: createStandardMaterial('ruleStrong', { roughness: 1 }),
  },
} as const
