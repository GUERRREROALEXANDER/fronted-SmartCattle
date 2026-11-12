import { describe, expect, it } from 'vitest'
import type { DailyActivity } from '../../types/domain'
import { dayTitle, observedText, postureShares, shiftDay } from './reportModel'

const herd = (lying: number, standing: number, walking: number): DailyActivity => ({
  observedMinutes: 100, lyingMinutes: lying, standingMinutes: standing, walkingMinutes: walking,
  peakCattle: 3, peakPeople: 0, minutesWithPeople: 0, lyingShare: null,
})

describe('postureShares', () => {
  it('splits the time with a known posture, largest first', () => {
    const rows = postureShares(herd(60, 30, 10))
    expect(rows.map(row => row.key)).toEqual(['lying', 'standing', 'walking'])
    expect(rows[0].share).toBeCloseTo(0.6)
  })
  it('invents nothing when no posture was recorded', () => {
    expect(postureShares(herd(0, 0, 0))).toEqual([])
  })
})

describe('days', () => {
  it('moves across a month', () => {
    expect(shiftDay('2026-11-01', -1)).toBe('2026-10-31')
  })
  it('names today and yesterday', () => {
    expect(dayTitle('2026-11-03', '2026-11-03')).toBe('Hoy')
    expect(dayTitle('2026-11-02', '2026-11-03')).toBe('Ayer')
  })
  it('says long observations in hours', () => {
    expect(observedText(45)).toBe('45 min')
    expect(observedText(600)).toBe('10 h')
  })
})
