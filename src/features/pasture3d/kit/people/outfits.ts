import { Color, DoubleSide, MeshPhysicalMaterial, MeshStandardMaterial } from 'three'
import type { Material, Texture } from 'three'
import type { PersonRole } from '../../simulation/herdSimulation'
import {
  clothTexture,
  denimTexture,
  leatherTexture,
  plaidTexture,
  strawTexture,
} from '../textures'

export interface Outfit {
  hat: 'straw' | 'cap'
  tallBoots: boolean
  rolledSleeves: boolean
  pockets: boolean
  machete: boolean
  mustache: boolean
  materials: Record<
    'skin' | 'hair' | 'eye' | 'shirt' | 'pants' | 'boots' | 'belt' | 'buckle' | 'hat' | 'hatBand',
    Material
  >
}

const SKIN_TONES = ['#b97e58', '#9a6646', '#c99470', '#7f5137']
const cache = new Map<string, Material>()

function cached<T extends Material>(key: string, create: () => T): T {
  let material = cache.get(key)
  if (!material) {
    material = create()
    cache.set(key, material)
  }
  return material as T
}

function repeat(texture: Texture, x: number, y: number) {
  const clone = texture.clone()
  clone.repeat.set(x, y)
  clone.needsUpdate = true
  return clone
}

function skin(tone: string) {
  return cached(`skin-${tone}`, () => new MeshPhysicalMaterial({
    color: tone,
    roughness: 0.52,
    sheen: 0.35,
    sheenRoughness: 0.5,
    sheenColor: new Color('#a0503a'),
  }))
}

const fabric = (key: string, map: Texture, roughness = 0.86, sheen = 0.3) => cached(key, () => new MeshPhysicalMaterial({
  map,
  roughness,
  sheen,
  sheenRoughness: 0.7,
  sheenColor: new Color('#ffffff'),
}))

/** Farmhands wear jeans, a plaid shirt, an aguadeño hat and boots; visitors a polo, chinos and a cap. */
export function outfitFor(role: PersonRole, seed: number): Outfit {
  const worker = role === 'worker'
  const variant = Math.floor(seed * 4)
  const shirts = [
    () => plaidTexture('red', '#7d231f', '#2a1412', '#d9c9a8'),
    () => plaidTexture('blue', '#2e4e78', '#18263d', '#d8dbe0'),
    () => plaidTexture('green', '#3d5a35', '#1d2a1a', '#cfc6a0'),
    () => plaidTexture('tan', '#9a7b52', '#4a3420', '#e8dcc0'),
  ]
  const shirtKey = worker ? `shirt-plaid-${variant}` : `shirt-polo-${variant % 2}`
  const shirt = fabric(
    shirtKey,
    worker ? repeat(shirts[variant](), 3, 3) : clothTexture(`polo-${variant % 2}`, variant % 2 ? '#e8e3d6' : '#3f6f8f'),
    0.82,
  )
  const pants = worker
    ? fabric('pants-denim', repeat(denimTexture(), 3, 4), 0.9, 0.2)
    : fabric('pants-chino', clothTexture('chino', '#b6a17a'), 0.88, 0.15)
  const rubber = worker && variant % 2 === 1
  const boots = rubber
    ? cached('boots-rubber', () => new MeshPhysicalMaterial({ color: '#141414', roughness: 0.32, clearcoat: 0.6, clearcoatRoughness: 0.3 }))
    : worker
      ? cached('boots-leather', () => new MeshPhysicalMaterial({ map: leatherTexture(), roughness: 0.48, clearcoat: 0.35, clearcoatRoughness: 0.4 }))
      : cached('shoes', () => new MeshStandardMaterial({ color: '#5a4a3a', roughness: 0.7 }))

  return {
    hat: worker ? 'straw' : 'cap',
    tallBoots: worker,
    rolledSleeves: worker && variant !== 1,
    pockets: worker,
    machete: worker && variant % 2 === 0,
    mustache: worker && variant !== 2,
    materials: {
      skin: skin(SKIN_TONES[Math.floor(seed * 97) % SKIN_TONES.length]),
      hair: cached('hair', () => new MeshPhysicalMaterial({ color: '#17110d', roughness: 0.55, sheen: 0.6, side: DoubleSide })),
      eye: cached('eye', () => new MeshPhysicalMaterial({ color: '#120d0a', roughness: 0.05, clearcoat: 1 })),
      shirt,
      pants,
      boots,
      belt: cached('belt', () => new MeshStandardMaterial({ color: '#3a2416', roughness: 0.55 })),
      buckle: cached('buckle', () => new MeshStandardMaterial({ color: '#c9b27a', metalness: 1, roughness: 0.3 })),
      hat: worker
        ? cached('hat-straw', () => new MeshStandardMaterial({ map: repeat(strawTexture(), 6, 3), roughness: 0.78, side: DoubleSide }))
        : cached('hat-cap', () => new MeshStandardMaterial({ color: '#2f4a36', roughness: 0.8, side: DoubleSide })),
      hatBand: cached('hat-band', () => new MeshStandardMaterial({ color: '#111111', roughness: 0.6 })),
    },
  }
}
