export type Rng = () => number

/** A small deterministic generator suitable for repeatable simulation runs. */
export function mulberry32(seed: number): Rng {
  let state = seed >>> 0

  return () => {
    state = (state + 0x6d2b79f5) >>> 0
    let value = state
    value = Math.imul(value ^ (value >>> 15), value | 1)
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61)
    return ((value ^ (value >>> 14)) >>> 0) / 4_294_967_296
  }
}

export function randomRange(rng: Rng, min: number, max: number): number {
  return min + (max - min) * rng()
}
