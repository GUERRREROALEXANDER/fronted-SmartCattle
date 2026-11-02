import { describe, expect, it, vi } from 'vitest'
import type { SafeStorage } from '../../lib/safeStorage'
import { demoAccounts, demoPassword } from '../../mocks/mockAuth'
import { createMockAuthService, hashPassword, LOGIN_COOLDOWN_MS } from './mockAuthService'
import { createAuthService } from './authService'

function setup({ now }: { now?: () => number } = {}) {
  const memory = new Map<string, string>()
  const storage: SafeStorage = {
    getJson: <T,>(key: string) => {
      try { return JSON.parse(memory.get(key) ?? 'null') as T | null }
      catch { return null }
    },
    setJson: (key, value) => { memory.set(key, JSON.stringify(value)) },
    remove: key => { memory.delete(key) },
  }
  return { service: createMockAuthService({ delayMs: 0, storage, now }), memory, storage }
}

describe('demo authentication', () => {
  it('restores local sessions without scheduling the simulated delay', async () => {
    const { service, storage } = setup()
    const session = await service.login({ identifier: demoAccounts[0].email, password: demoPassword })
    vi.useFakeTimers()
    try {
      const restored = createMockAuthService({ delayMs: 400, storage }).getSession()
      expect(vi.getTimerCount()).toBe(0)
      await expect(restored).resolves.toEqual(session)
    } finally { vi.useRealTimers() }
  })

  it.each(demoAccounts)('logs in $role with email and restores the session', async account => {
    const { service, storage } = setup()
    const session = await service.login({ identifier: account.email, password: demoPassword })
    expect(session.user).toEqual(account)
    expect(session.source).toBe('mock')
    expect(new Date(session.issuedAt).toISOString()).toBe(session.issuedAt)
    expect(await service.getSession()).toEqual(session)
    expect(await createMockAuthService({ delayMs: 0, storage }).getSession()).toEqual(session)
  })

  it.each(demoAccounts)('logs in $role with a case-insensitive username', async account => {
    const { service } = setup()
    const session = await service.login({ identifier: `  ${account.username.toUpperCase()} `, password: demoPassword })
    expect(session.user).toEqual(account)
  })

  it.each([
    { identifier: demoAccounts[0].email, password: 'wrong' },
    { identifier: 'unknown@sanjose.demo', password: demoPassword },
    { identifier: 'unknown.user', password: demoPassword },
  ])('rejects incorrect credentials', async input => {
    await expect(setup().service.login(input)).rejects.toMatchObject({ code: 'invalid_credentials' })
  })

  it('normalizes email case and whitespace', async () => {
    const { service } = setup()
    const session = await service.login({ identifier: '  DUENO@SANJOSE.DEMO ', password: demoPassword })
    expect(session.user).toEqual(demoAccounts[0])
  })

  it('registers an owner, saves a session and only stores password hashes', async () => {
    const { service, memory } = setup()
    const input = { username: 'ana.ruiz', email: ' ANA@example.com ', password: 'unique-password' }
    const session = await service.register(input)
    expect(session.user).toMatchObject({ username: input.username, name: input.username, email: 'ana@example.com', role: 'owner', farmId: 'farm-san-jose' })
    expect(await service.getSession()).toEqual(session)
    const stored = memory.get('smartcattle.demo.users')!
    expect(stored).not.toContain(input.password)
    expect(stored).not.toContain(demoPassword)
    expect(stored).toContain(await hashPassword(input.password))
    expect(memory.get('smartcattle.demo.session')).not.toContain('password')
    expect((await service.login({ identifier: input.email, password: input.password })).user).toEqual(session.user)
    expect((await service.login({ identifier: input.username.toUpperCase(), password: input.password })).user).toEqual(session.user)
  })

  it('rejects duplicate demo and registered emails after normalization', async () => {
    const { service } = setup()
    const input = { username: 'ana.ruiz', email: 'ana@example.com', password: 'secret' }
    await service.register(input)
    await expect(service.register({ ...input, username: 'otra.ana', email: ' ANA@EXAMPLE.COM ' })).rejects.toMatchObject({ code: 'email_taken' })
    await expect(service.register({ ...input, username: 'otra.ana', email: demoAccounts[0].email })).rejects.toMatchObject({ code: 'email_taken' })
  })

  it('rejects duplicate demo and registered usernames after normalization', async () => {
    const { service } = setup()
    const input = { username: 'ana.ruiz', email: 'ana@example.com', password: 'secret' }
    await service.register(input)
    await expect(service.register({ ...input, username: ' ANA.RUIZ ', email: 'otra@example.com' })).rejects.toMatchObject({ code: 'username_taken' })
    await expect(service.register({ ...input, username: demoAccounts[0].username.toUpperCase(), email: 'otra@example.com' })).rejects.toMatchObject({ code: 'username_taken' })
  })

  it('locks an account for 30 seconds after five failed attempts', async () => {
    let time = 1_000
    const { service } = setup({ now: () => time })
    const invalid = { identifier: demoAccounts[0].username, password: 'wrong' }
    for (let attempt = 1; attempt <= 4; attempt += 1) {
      await expect(service.login(invalid)).rejects.toMatchObject({ code: 'invalid_credentials' })
    }
    await expect(service.login(invalid)).rejects.toMatchObject({ code: 'rate_limited', retryAfterMs: LOGIN_COOLDOWN_MS })
    await expect(service.login({ identifier: demoAccounts[0].email, password: demoPassword })).rejects.toMatchObject({ code: 'rate_limited' })
    time += LOGIN_COOLDOWN_MS - 1
    await expect(service.login(invalid)).rejects.toMatchObject({ code: 'rate_limited', retryAfterMs: 1 })
    time += 1
    await expect(service.login({ identifier: demoAccounts[0].username, password: demoPassword })).resolves.toMatchObject({ user: demoAccounts[0] })
  })

  it('clears the session on logout', async () => {
    const { service, memory } = setup()
    await service.login({ identifier: demoAccounts[0].email, password: demoPassword })
    await service.logout()
    expect(await service.getSession()).toBeNull()
    expect(memory.has('smartcattle.demo.session')).toBe(false)
  })

  it('returns null for missing, invalid JSON and malformed sessions', async () => {
    const { service, memory } = setup()
    expect(await service.getSession()).toBeNull()
    for (const value of ['broken', '{}', 'null', '{"source":"api"}']) {
      memory.set('smartcattle.demo.session', value)
      expect(await service.getSession()).toBeNull()
    }
  })

  it('uses the demo accounts in mock mode', async () => {
    const service = createAuthService('mock')
    const session = await service.login({ identifier: demoAccounts[0].username, password: demoPassword })
    expect(session.source).toBe('mock')
    // A demo session has no token, which is what makes it unusable against
    // the backend rather than quietly half-working.
    expect(session.accessToken).toBeUndefined()
  })

})
