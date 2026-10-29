import type { Animal, AnimalStatus } from '../../types/domain'

/** How long without a sighting counts as "not seen recently". */
export const STALE_AFTER_HOURS = 24

export interface HerdCounts {
  total: number
  active: number
  lost: number
  inactive: number
  /** Registered and never detected. Not the same as detected long ago. */
  neverSeen: number
  /** Active, seen at some point, but not within STALE_AFTER_HOURS. */
  stale: number
}

export function countHerd(animals: readonly Animal[], now: Date): HerdCounts {
  const staleBefore = now.getTime() - STALE_AFTER_HOURS * 3_600_000
  const counts: HerdCounts = {
    total: animals.length, active: 0, lost: 0, inactive: 0, neverSeen: 0, stale: 0,
  }
  for (const animal of animals) {
    if (animal.status === 'active') counts.active++
    if (animal.status === 'lost') counts.lost++
    if (animal.status === 'inactive') counts.inactive++
    // Only active animals are counted as unseen: an inactive animal is not
    // expected to be anywhere, so reporting it as missing is noise.
    if (animal.status !== 'active') continue
    if (animal.lastDetection === null) counts.neverSeen++
    else if (animal.lastDetection.getTime() < staleBefore) counts.stale++
  }
  return counts
}

/**
 * The animals worth looking at first, most concerning first.
 *
 * Ordered by how much the farm should worry rather than by tag: an animal
 * marked lost, then one registered and never seen, then one not seen for a
 * while. A list sorted by tag buries all three among the healthy rows.
 */
export function needsAttention(animals: readonly Animal[], now: Date): Animal[] {
  const staleBefore = now.getTime() - STALE_AFTER_HOURS * 3_600_000
  const concern = (animal: Animal): number => {
    if (animal.status === 'lost') return 0
    if (animal.status !== 'active') return 3
    if (animal.lastDetection === null) return 1
    return animal.lastDetection.getTime() < staleBefore ? 2 : 3
  }
  return animals
    .filter(animal => concern(animal) < 3)
    .sort((first, second) => {
      const byConcern = concern(first) - concern(second)
      if (byConcern !== 0) return byConcern
      // Within a group, the one unseen longest comes first. A null sorts
      // before any date, which is correct: never seen is worse than stale.
      const firstSeen = first.lastDetection?.getTime() ?? -Infinity
      const secondSeen = second.lastDetection?.getTime() ?? -Infinity
      return firstSeen - secondSeen
    })
}

/** How long since an animal was seen, or null when it never has been. */
export function hoursSinceSeen(animal: Animal, now: Date): number | null {
  if (animal.lastDetection === null) return null
  return (now.getTime() - animal.lastDetection.getTime()) / 3_600_000
}

export function byStatus(animals: readonly Animal[], status: AnimalStatus): Animal[] {
  return animals.filter(animal => animal.status === status)
}
