import { describe, expect, it, vi } from 'vitest'
import { createApiAuthService } from './apiAuthService'
import { NOW, memoryStorage, scriptedFetch, tokenResponse } from './testDoubles'

const credentials = { identifier: 'ana@finca.example', password: 'una-clave-larga' }

function failing(response: Response) {
  return createApiAuthService({
    fetchImpl: scriptedFetch(response), storage: memoryStorage(), now: () => NOW,
  })
}

describe('mapping backend failures', () => {
  it('reports a 401 as wrong credentials', async () => {
    // The backend answers the same 401 for a wrong password, an unknown
    // address and a deactivated account, deliberately. One message is not a
    // loss of detail: there is no detail to show.
    const auth = failing(Response.json({ detail: 'Invalid email or password' }, { status: 401 }))
    await expect(auth.login(credentials)).rejects.toMatchObject({ code: 'invalid_credentials' })
  })

  it('reports a 409 as a taken address', async () => {
    const auth = failing(Response.json({ detail: 'That email is already registered' }, { status: 409 }))
    await expect(auth.register({ email: 'ana@finca.example', password: 'una-clave-larga' }))
      .rejects.toMatchObject({ code: 'email_taken' })
  })

  it('reports a 429 as too many attempts', async () => {
    const auth = failing(Response.json({ detail: 'Too many failed attempts' }, { status: 429 }))
    await expect(auth.login(credentials)).rejects.toMatchObject({ code: 'rate_limited' })
  })

  it('reports a 503 as authentication not available', async () => {
    // JWT_SECRET is unset on this deployment. Not an outage and not bad
    // credentials: the feature is switched off, and the message says so.
    const auth = failing(Response.json({ detail: 'Authentication is not configured' }, { status: 503 }))
    await expect(auth.login(credentials)).rejects.toMatchObject({ code: 'unavailable' })
  })

  it('recognises the bcrypt byte limit in a 422', async () => {
    // The only 422 a correct client can provoke, because the form validates
    // everything else first. The message has to name bytes: accented letters
    // count as two, so a password well under 72 characters can exceed it.
    const auth = failing(Response.json({
      detail: [{ loc: ['body', 'password'], msg: 'password must be at most 72 bytes (it is 80)' }],
    }, { status: 422 }))
    const error = await auth.register({ email: 'a@finca.example', password: 'x' }).catch(caught => caught)
    expect(error).toMatchObject({ code: 'password_too_long' })
    expect(error.message).toContain('72 bytes')
  })

  it('reports any other 422 as a server problem', async () => {
    const auth = failing(Response.json({ detail: [{ msg: 'something else' }] }, { status: 422 }))
    await expect(auth.login(credentials)).rejects.toMatchObject({ code: 'server' })
  })

  it('reports a 500 as a server problem', async () => {
    const auth = failing(Response.json({ detail: 'Internal server error' }, { status: 500 }))
    await expect(auth.login(credentials)).rejects.toMatchObject({ code: 'server' })
  })

  it('reports an unreachable backend as a connection problem', async () => {
    // Distinct from a server error on purpose: "check the connection" is
    // something the user can act on, and on a rural link it is usually right.
    const auth = createApiAuthService({
      fetchImpl: vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch')),
      storage: memoryStorage(), now: () => NOW,
    })
    await expect(auth.login(credentials)).rejects.toMatchObject({ code: 'network' })
  })

  it('reports a timeout as a connection problem', async () => {
    const auth = createApiAuthService({
      fetchImpl: vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {})),
      storage: memoryStorage(), now: () => NOW,
    })
    await expect(auth.login({ ...credentials })).rejects.toMatchObject({ code: 'network' })
  }, 15000)

  it.each([
    ['no token', { ...tokenResponse, access_token: undefined }],
    ['an empty token', { ...tokenResponse, access_token: '' }],
    ['no user', { ...tokenResponse, user: undefined }],
    ['a user with no email', { ...tokenResponse, user: { id: 7, full_name: 'Ana', role: 'owner' } }],
    ['an unknown role', { ...tokenResponse, user: { id: 7, email: 'a@b.c', full_name: 'Ana', role: 'admin' } }],
    ['a non-numeric id', { ...tokenResponse, user: { id: '7', email: 'a@b.c', full_name: 'Ana', role: 'owner' } }],
  ])('reports a 200 with %s as a server problem, not bad credentials', async (_label, body) => {
    // Telling someone their password is wrong because the response was
    // unreadable sends them in circles changing a password that was fine.
    const auth = failing(Response.json(body))
    await expect(auth.login(credentials)).rejects.toMatchObject({ code: 'server' })
  })

  it('does not persist a session it could not read', async () => {
    const storage = memoryStorage()
    const auth = createApiAuthService({
      fetchImpl: scriptedFetch(Response.json({ ...tokenResponse, access_token: '' })),
      storage, now: () => NOW,
    })
    await expect(auth.login(credentials)).rejects.toThrow()
    expect(storage.entries.size).toBe(0)
  })
})
