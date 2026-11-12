import { describe, expect, it } from 'vitest'
import { luciaMood, talkingMs } from './luciaMood'

describe('Lucía', () => {
  it('thinks while the answer is on its way, even if she was still talking', () => {
    expect(luciaMood(true, true)).toBe('thinking')
    expect(luciaMood(false, true)).toBe('talking')
    expect(luciaMood(false, false)).toBe('idle')
  })

  it('talks longer for a longer answer, within limits', () => {
    expect(talkingMs('Sí')).toBe(1200)
    expect(talkingMs('a'.repeat(100))).toBe(2800)
    expect(talkingMs('a'.repeat(5000))).toBe(5000)
  })
})
