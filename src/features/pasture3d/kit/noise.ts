// Small deterministic value-noise helpers for terrain, scatter and textures (no allocations).

export function hash2(x: number, z: number) {
  const s = Math.sin(x * 127.1 + z * 311.7) * 43758.5453
  return s - Math.floor(s)
}

export function noise2(x: number, z: number) {
  const ix = Math.floor(x)
  const iz = Math.floor(z)
  const fx = x - ix
  const fz = z - iz
  const ux = fx * fx * (3 - 2 * fx)
  const uz = fz * fz * (3 - 2 * fz)
  const a = hash2(ix, iz)
  const b = hash2(ix + 1, iz)
  const c = hash2(ix, iz + 1)
  const d = hash2(ix + 1, iz + 1)
  return a + (b - a) * ux + (c - a) * uz + (a - b - c + d) * ux * uz
}

/** Three octaves, roughly 0..1 with mean 0.5. */
export function fbm2(x: number, z: number) {
  return noise2(x, z) * 0.55
    + noise2(x * 2.1 + 5.2, z * 2.1 + 1.3) * 0.3
    + noise2(x * 4.3 + 9.1, z * 4.3 + 3.7) * 0.15
}

export function smoothstep(edge0: number, edge1: number, value: number) {
  const t = Math.min(1, Math.max(0, (value - edge0) / (edge1 - edge0)))
  return t * t * (3 - 2 * t)
}

/** Stable 0..1 hash of an id, so each cow or person keeps its look across renders. */
export function hashString(text: string) {
  let h = 2166136261
  for (let index = 0; index < text.length; index += 1) {
    h ^= text.charCodeAt(index)
    h = Math.imul(h, 16777619)
  }
  return ((h >>> 0) % 100_000) / 100_000
}
