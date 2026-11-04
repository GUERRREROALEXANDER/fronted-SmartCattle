import { describe, expect, it } from 'vitest'
import { onboardingOf, saveOnboarding, suggestionsFor } from './onboardingModel'

describe('onboarding answers', () => {
  it('belong to one account', () => {
    saveOnboarding('ana', { goals: ['zone'], start: '/live' })
    expect(onboardingOf('ana')?.start).toBe('/live')
    expect(onboardingOf('luis')).toBeNull()
  })
})

describe('suggestionsFor', () => {
  it('leads with the goals and keeps four at most, without repeats', () => {
    const rest = ['¿Cómo está el ganado ahora?', 'a', 'b', 'c']
    const list = suggestionsFor(['report', 'lying'], rest)
    expect(list[0]).toBe('¿Qué pasó anoche?')
    expect(list).toHaveLength(4)
    expect(new Set(list).size).toBe(4)
  })
})
