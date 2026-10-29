import { describe, expect, it } from 'vitest'
import { createApiAuthService } from './apiAuthService'
import { NOW, apiUser, memoryStorage, scriptedFetch, tokenResponse } from './testDoubles'

const credentials = { identifier: 'Ana@Finca.Example', password: 'una-clave-larga' }

function service(fetchImpl: ReturnType<typeof scriptedFetch>, storage = memoryStorage()) {
  return { service: createApiAuthService({ fetchImpl, storage, now: () => NOW }), storage }
}

describe('login', () => {
  it('returns an api session carrying the token', async () => {
    const { service: auth } = service(scriptedFetch(Response.json(tokenResponse)))
    const session = await auth.login(credentials)

    expect(session.source).toBe('api')
    expect(session.accessToken).toBe('a-signed-token')
    expect(session.user).toEqual({
      id: '7', name: 'Ana Restrepo', email: 'ana@finca.example', role: 'owner',
    })
    // No username and no farmId invented: the backend has neither, and showing
    // a made-up farm identifier in the profile would be a lie.
    expect(session.user.username).toBeUndefined()
    expect(session.user.farmId).toBeUndefined()
  })

  it('computes when the token stops being accepted', async () => {
    const { service: auth } = service(scriptedFetch(Response.json(tokenResponse)))
    const session = await auth.login(credentials)
    // expires_in is 3600 seconds from the login instant.
    expect(session.expiresAt).toBe('2026-10-29T13:00:00.000Z')
  })

  it('lower-cases and trims the address before sending it', async () => {
    const fetchImpl = scriptedFetch(Response.json(tokenResponse))
    const { service: auth } = service(fetchImpl)
    await auth.login({ ...credentials, identifier: '  Ana@Finca.Example  ' })

    const body = JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string)
    // users.email carries CHECK (email = lower(email)); normalising here means
    // the same person signs in whatever they type.
    expect(body).toEqual({ email: 'ana@finca.example', password: 'una-clave-larga' })
  })

  it('persists the session so a reload keeps it', async () => {
    const { service: auth, storage } = service(scriptedFetch(Response.json(tokenResponse)))
    const session = await auth.login(credentials)
    expect(storage.entries.get('smartcattle.session')).toEqual(session)
  })

  it('omits expiresAt when the backend sends no lifetime', async () => {
    // Rather than inventing one. An absent expiry means "ask the backend",
    // which is correct; a guessed one would sign the user out early.
    const { expires_in: _unused, ...withoutLifetime } = tokenResponse
    const { service: auth } = service(scriptedFetch(Response.json(withoutLifetime)))
    expect((await auth.login(credentials)).expiresAt).toBeUndefined()
  })
})

describe('register', () => {
  it('sends the address as the name when none is given', async () => {
    const fetchImpl = scriptedFetch(Response.json(tokenResponse))
    const { service: auth } = service(fetchImpl)
    await auth.register({ email: 'ana@finca.example', password: 'una-clave-larga' })

    const body = JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string)
    // full_name is required by the backend and optional in the form, and an
    // empty string would be rejected.
    expect(body.full_name).toBe('ana@finca.example')
  })

  it('sends the name when there is one', async () => {
    const fetchImpl = scriptedFetch(Response.json(tokenResponse))
    const { service: auth } = service(fetchImpl)
    await auth.register({ email: 'ana@finca.example', password: 'una-clave-larga', name: '  Ana  ' })

    const body = JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string)
    expect(body.full_name).toBe('Ana')
  })

  it('signs the new account in', async () => {
    const { service: auth, storage } = service(scriptedFetch(Response.json(tokenResponse)))
    const session = await auth.register({ email: 'ana@finca.example', password: 'una-clave-larga' })
    expect(session.accessToken).toBe('a-signed-token')
    expect(storage.entries.has('smartcattle.session')).toBe(true)
  })

  it('reads the role the backend assigned', async () => {
    // The first account is the owner and the rest are workers; the client does
    // not get to choose, so it has to read what came back.
    const worker = { ...tokenResponse, user: { ...apiUser, role: 'worker' } }
    const { service: auth } = service(scriptedFetch(Response.json(worker)))
    expect((await auth.register({ email: 'b@finca.example', password: 'una-clave-larga' })).user.role)
      .toBe('worker')
  })
})

describe('logout', () => {
  it('drops the session without calling the backend', async () => {
    // There is no revocation list to call, so signing out is local.
    const fetchImpl = scriptedFetch()
    const storage = memoryStorage({ 'smartcattle.session': { source: 'api' } })
    const auth = createApiAuthService({ fetchImpl, storage, now: () => NOW })

    await auth.logout()
    expect(storage.entries.has('smartcattle.session')).toBe(false)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
