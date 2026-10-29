import { describe, expect, it } from 'vitest'
import { memoryStorage } from '../services/auth/testDoubles'
import { SESSION_STORAGE_KEY, authHeaders, readAccessToken } from './session'

const apiSession = {
  user: { id: '7', name: 'Ana', email: 'ana@finca.example', role: 'owner' },
  issuedAt: '2026-10-29T12:00:00Z',
  source: 'api',
  accessToken: 'a-signed-token',
}

describe('readAccessToken', () => {
  it('returns the token of an api session', () => {
    const storage = memoryStorage({ [SESSION_STORAGE_KEY]: apiSession })
    expect(readAccessToken(storage)).toBe('a-signed-token')
  })

  it.each([
    ['nothing stored', undefined],
    ['a demo session', { ...apiSession, source: 'mock' }],
    ['no token', { ...apiSession, accessToken: undefined }],
    ['an empty token', { ...apiSession, accessToken: '' }],
    ['junk', 'not an object'],
  ])('returns null for %s', (_label, stored) => {
    const storage = stored === undefined ? memoryStorage() : memoryStorage({ [SESSION_STORAGE_KEY]: stored })
    expect(readAccessToken(storage)).toBeNull()
  })
})

describe('authHeaders', () => {
  it('builds the bearer header when there is a token', () => {
    const storage = memoryStorage({ [SESSION_STORAGE_KEY]: apiSession })
    expect(authHeaders(storage)).toEqual({ Authorization: 'Bearer a-signed-token' })
  })

  it('is empty without one', () => {
    // An empty object, not a header with no value: an anonymous request has to
    // stay anonymous rather than carry something the backend must reject, and
    // an empty Authorization turns a clean 401 into a header parsing error.
    expect(authHeaders(memoryStorage())).toEqual({})
  })

  it('is empty for a demo session', () => {
    const storage = memoryStorage({ [SESSION_STORAGE_KEY]: { ...apiSession, source: 'mock' } })
    expect(authHeaders(storage)).toEqual({})
  })
})
