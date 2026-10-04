import { describe, expect, it } from 'vitest'
import { formatConfidence, formatCount, formatRelative, formatTime } from './format'

const now = new Date('2026-10-04T15:00:00')

describe('format', () => {
  it('formats 24-hour times', () => {
    expect(formatTime(new Date('2026-10-04T02:14:00'))).toBe('02:14')
  })

  it('formats confidence as a rounded percentage', () => {
    expect(formatConfidence(0.947).replace(/\s/g, '')).toBe('95%')
  })

  it('formats counts with Spanish grouping', () => {
    expect(formatCount(1440).replace(/\s/g, ' ')).toMatch(/^1.?440$/)
  })

  it('formats relative times', () => {
    expect(formatRelative(new Date(now.getTime() - 20_000), now)).toBe('ahora')
    expect(formatRelative(new Date(now.getTime() - 15 * 60_000), now)).toBe('hace 15 minutos')
    expect(formatRelative(new Date(now.getTime() - 3 * 3_600_000), now)).toBe('hace 3 horas')
    expect(formatRelative(new Date(now.getTime() - 30 * 3_600_000), now)).toBe('ayer')
    expect(formatRelative(new Date(now.getTime() + 60_000), now)).toBe('ahora')
    // 40 h before Oct 4 15:00 is Oct 2 23:00: two calendar days back, so "anteayer" even though it is under 48 h.
    expect(formatRelative(new Date(now.getTime() - 40 * 3_600_000), now)).toBe('anteayer')
  })
})
