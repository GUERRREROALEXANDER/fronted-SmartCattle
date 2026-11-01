import { describe, expect, it, vi } from 'vitest'
import { requestJson } from '../../api/httpClient'
import { createTokenStore, tokenStore } from '../../api/session'
import { createSafeStorage } from '../../lib/safeStorage'
import { AuthError } from '../../types/auth'
import { createApiAuthService } from './apiAuthService'

const memoryStorage = () => createSafeStorage(() => { throw new Error('no localStorage in this test') })
const user = { id: 3, email: 'ana@finca.co', full_name: 'Ana Ruiz', role: 'owner', is_active: true, created_at: '2026-10-01T00:00:00Z' }
const token = { access_token: 'jwt-123', token_type: 'bearer', expires_in: 3600, user }

describe('backend sign-in', () => {
  it('stores the bearer token and maps the account', async () => {
    const tokens = createTokenStore(memoryStorage())
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json(token))
    const session = await createApiAuthService({ fetchImpl, tokens }).login({ identifier: ' ana@finca.co ', password: 'secreto123' })
    expect(session).toMatchObject({ source: 'api', user: { id: '3', name: 'Ana Ruiz', email: 'ana@finca.co', role: 'owner', farmId: null } })
    expect(tokens.get()).toBe('jwt-123')
    const [url, init] = fetchImpl.mock.calls[0]
    expect(String(url)).toMatch(/\/api\/auth\/login$/)
    expect(JSON.parse(String(init?.body))).toEqual({ email: 'ana@finca.co', password: 'secreto123' })
  })

  it.each([
    [401, 'invalid_credentials'],
    [422, 'invalid_credentials'],
    [429, 'rate_limited'],
    [503, 'unavailable'],
  ] as const)('maps HTTP %i to %s', async (status, code) => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ detail: 'x' }, { status }))
    const service = createApiAuthService({ fetchImpl, tokens: createTokenStore(memoryStorage()) })
    await expect(service.login({ identifier: 'ana@finca.co', password: 'x' })).rejects.toMatchObject({ code })
  })

  it('reports a taken email on registration', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ detail: 'taken' }, { status: 409 }))
    const service = createApiAuthService({ fetchImpl, tokens: createTokenStore(memoryStorage()) })
    await expect(service.register({ username: 'ana', email: 'ana@finca.co', password: 'secreto123' })).rejects.toEqual(new AuthError('email_taken'))
  })

  it('restores the session from a stored token and drops a rejected one', async () => {
    const tokens = createTokenStore(memoryStorage())
    tokens.set('jwt-123', 3600)
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValueOnce(Response.json(user))
    const service = createApiAuthService({ fetchImpl, tokens })
    expect((await service.getSession())?.user.email).toBe('ana@finca.co')
    expect(fetchImpl.mock.calls[0][1]?.headers).toEqual({ Authorization: 'Bearer jwt-123' })

    fetchImpl.mockResolvedValueOnce(Response.json({ detail: 'expired' }, { status: 401 }))
    expect(await service.getSession()).toBeNull()
    expect(tokens.get()).toBeNull()
  })

  it('forgets an expired token without asking the backend', async () => {
    let now = 1_000
    const tokens = createTokenStore(memoryStorage(), () => now)
    tokens.set('jwt-123', 60)
    now += 61_000
    expect(tokens.get()).toBeNull()
  })
})

describe('authorized requests', () => {
  it('signs everyone out when the backend rejects the shared token', async () => {
    const rejected = vi.fn()
    const stop = tokenStore.onRejected(rejected)
    try {
      const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ detail: 'expired' }, { status: 401 }))
      await expect(requestJson('/api/alerts', { fetchImpl, token: 'old' })).rejects.toMatchObject({ status: 401 })
      expect(rejected).toHaveBeenCalledOnce()
    } finally { stop() }
  })
  it('sends query parameters and JSON bodies', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    await requestJson('/api/x', { fetchImpl, token: null, method: 'PATCH', body: { a: 1 }, query: { b: 'c', skip: undefined } })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(String(url)).toMatch(/\/api\/x\?b=c$/)
    expect(init).toMatchObject({ method: 'PATCH', body: '{"a":1}', headers: { 'Content-Type': 'application/json' } })
  })
})
