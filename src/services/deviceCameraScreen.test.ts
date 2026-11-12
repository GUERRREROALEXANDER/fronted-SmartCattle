import { describe, expect, it } from 'vitest'
import { isScreenCamera, rememberScreenCamera, screenShareProblem } from './deviceCamera'

const named = (name: string) => Object.assign(new Error('x'), { name })

describe('screenShareProblem', () => {
  it('says nothing when the person just closed the dialog', () => {
    expect(screenShareProblem(named('NotAllowedError'))).toBe('')
    expect(screenShareProblem(named('AbortError'))).toBe('')
  })

  it('points to a browser that can do it when this one cannot', () => {
    expect(screenShareProblem(new TypeError())).toContain('Chrome')
  })

  it('has words for anything else', () => {
    expect(screenShareProblem(named('NotReadableError'))).toContain('otra')
  })
})

describe('isScreenCamera', () => {
  it('knows only the cameras set up as a window', () => {
    rememberScreenCamera('window-cam')
    expect(isScreenCamera('window-cam')).toBe(true)
    expect(isScreenCamera('phone-cam')).toBe(false)
  })
})
