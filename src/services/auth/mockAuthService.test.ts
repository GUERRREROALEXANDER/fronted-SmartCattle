import { describe, expect, it } from 'vitest'
import type { SafeStorage } from '../../lib/safeStorage'
import { demoAccounts, demoPassword } from '../../mocks/mockAuth'
import { createMockAuthService, hashPassword } from './mockAuthService'
import { createAuthService } from './authService'

function setup() {
  const memory = new Map<string, string>()
  const storage: SafeStorage = {
    getJson: <T,>(key: string) => {
      try { return JSON.parse(memory.get(key) ?? 'null') as T | null }
      catch { return null }
    },
    setJson: (key, value) => { memory.set(key, JSON.stringify(value)) },
    remove: key => { memory.delete(key) },
  }
  return { service: createMockAuthService({ delayMs: 0, storage }), memory, storage }
}

describe('demo authentication', () => {
  it.each(demoAccounts)('logs in $role and restores the session', async account => {
    const { service, storage } = setup()
    const session = await service.login({ email: account.email, password: demoPassword })
    expect(session.user).toEqual(account)
    expect(session.source).toBe('mock')
    expect(new Date(session.issuedAt).toISOString()).toBe(session.issuedAt)
    expect(await service.getSession()).toEqual(session)
    expect(await createMockAuthService({ delayMs: 0, storage }).getSession()).toEqual(session)
  })
  it.each([
    { email: demoAccounts[0].email, password: 'wrong' },
    { email: 'unknown@sanjose.demo', password: demoPassword },
  ])('rejects incorrect credentials', async input => {
    await expect(setup().service.login(input)).rejects.toMatchObject({ code: 'invalid_credentials' })
  })
  it('normalizes email case and whitespace', async () => {
    const { service } = setup()
    const session = await service.login({ email: '  DUENO@SANJOSE.DEMO ', password: demoPassword })
    expect(session.user).toEqual(demoAccounts[0])
  })
  it('registers an owner, saves a session and only stores password hashes', async () => {
    const { service, memory } = setup()
    const input = { name: 'Ana Ruiz', email: ' ANA@example.com ', password: 'unique-password' }
    const session = await service.register(input)
    expect(session.user).toMatchObject({ name: input.name, email: 'ana@example.com', role: 'owner', farmId: 'farm-san-jose' })
    expect(await service.getSession()).toEqual(session)
    const stored = memory.get('smartcattle.demo.users')!
    expect(stored).not.toContain(input.password)
    expect(stored).not.toContain(demoPassword)
    expect(stored).toContain(await hashPassword(input.password))
    expect(memory.get('smartcattle.demo.session')).not.toContain('password')
    expect((await service.login({ email: input.email, password: input.password })).user).toEqual(session.user)
  })
  it('rejects duplicate demo and registered emails after normalization', async () => {
    const { service } = setup()
    const input = { name: 'Ana', email: 'ana@example.com', password: 'secret' }
    await service.register(input)
    await expect(service.register({ ...input, email: ' ANA@EXAMPLE.COM ' })).rejects.toMatchObject({ code: 'email_taken' })
    await expect(service.register({ ...input, email: demoAccounts[0].email })).rejects.toMatchObject({ code: 'email_taken' })
  })
  it('clears the session on logout', async () => {
    const { service, memory } = setup()
    await service.login({ email: demoAccounts[0].email, password: demoPassword })
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
  it('provides unavailable authentication in API mode', async () => {
    const service = createAuthService('api')
    expect(await service.getSession()).toBeNull()
    await expect(service.login({ email: '', password: '' })).rejects.toMatchObject({ code: 'unavailable' })
    await expect(service.register({ name: '', email: '', password: '' })).rejects.toMatchObject({ code: 'unavailable' })
    await expect(service.logout()).resolves.toBeUndefined()
  })
})
