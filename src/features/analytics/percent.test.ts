import { describe, expect, it } from 'vitest'
import { formatPercentage, largestRemainderPercentages, percentageOf } from './percent'

describe('largestRemainderPercentages', () => {
  it('rounds thirds to integers that still total 100', () => {
    expect(largestRemainderPercentages([1, 1, 1])).toEqual([34, 33, 33])
  })

  it('uses input order to break equal-remainder ties', () => {
    const result = largestRemainderPercentages([1, 1, 1, 1, 1, 1, 1])
    expect(result).toEqual([15, 15, 14, 14, 14, 14, 14])
    expect(result.reduce((sum, value) => sum + value, 0)).toBe(100)
  })

  it('keeps exact percentages unchanged', () => {
    expect(largestRemainderPercentages([2, 2, 1])).toEqual([40, 40, 20])
  })

  it('returns zeroes for an empty distribution', () => {
    expect(largestRemainderPercentages([])).toEqual([])
    expect(largestRemainderPercentages([0, 0, 0])).toEqual([0, 0, 0])
  })

  it('handles large counts without losing the total', () => {
    const result = largestRemainderPercentages([123456, 234567, 345678])
    expect(result.reduce((sum, value) => sum + value, 0)).toBe(100)
  })
})

describe('percentage helpers', () => {
  it('rounds a single share and handles a zero total', () => {
    expect(percentageOf(1, 3)).toBe(33)
    expect(percentageOf(0, 0)).toBe(0)
    expect(formatPercentage(62)).toBe('62 %')
  })
})
