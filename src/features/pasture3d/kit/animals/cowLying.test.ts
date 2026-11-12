import { describe, expect, it } from 'vitest'
import { LYING_DROP, LYING_SECONDS, lyingPhases, stepRest } from './cowLying'

describe('lyingPhases', () => {
  it('stands at 0 and rests on the ground at 1', () => {
    expect(lyingPhases(0)).toEqual({ front: 0, hind: 0, drop: 0, pitch: 0 })
    const down = lyingPhases(1)
    expect(down.front).toBe(1)
    expect(down.hind).toBe(1)
    expect(down.drop).toBeCloseTo(LYING_DROP)
    expect(down.pitch).toBe(0)
  })

  it('folds the front legs first, dipping the nose on the way', () => {
    const halfway = lyingPhases(0.4)
    expect(halfway.front).toBeGreaterThan(halfway.hind)
    expect(halfway.pitch).toBeGreaterThan(0)
  })

  it('only ever comes down as it folds', () => {
    let last = -1
    for (let rest = 0; rest <= 1; rest += 0.05) {
      const { drop } = lyingPhases(rest)
      expect(drop).toBeGreaterThanOrEqual(last)
      last = drop
    }
  })
})

describe('stepRest', () => {
  it('takes the whole movement to get down', () => {
    expect(stepRest(0, true, LYING_SECONDS / 2)).toBeCloseTo(0.5)
    expect(stepRest(0.9, true, LYING_SECONDS)).toBe(1)
  })

  it('turns around from where it is', () => {
    expect(stepRest(0.5, false, LYING_SECONDS / 4)).toBeCloseTo(0.25)
  })

  it('skips the movement when motion is reduced', () => {
    expect(stepRest(0, true, 0.016, true)).toBe(1)
    expect(stepRest(1, false, 0.016, true)).toBe(0)
  })
})
