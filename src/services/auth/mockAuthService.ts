// DEVELOPMENT MOCK AUTH. Not secure, not backend data. Replace when the backend provides authentication.
import { safeStorage, type SafeStorage } from '../../lib/safeStorage'
import { demoAccounts, demoPassword } from '../../mocks/mockAuth'
import { AuthError, type AuthUser, type Session } from '../../types/auth'
import { mockDelay } from '../dataSource'
import type { AuthService } from './authService'

const usersKey = 'smartcattle.demo.users'
const sessionKey = 'smartcattle.demo.session'
export const MAX_LOGIN_ATTEMPTS = 5
export const LOGIN_COOLDOWN_MS = 30_000
interface StoredUser extends AuthUser { passwordHash: string }
interface LoginAttempts { failures: number; lockedUntil: number }

export async function hashPassword(password: string): Promise<string> {
  try {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
  } catch { throw new AuthError('unavailable') }
}

const normalizeIdentifier = (identifier: string) => identifier.trim().toLowerCase()

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false
  const { user, issuedAt, source } = value as Partial<Session>
  return source === 'mock' && typeof issuedAt === 'string' && !Number.isNaN(Date.parse(issuedAt))
    && !!user && typeof user.id === 'string' && typeof user.username === 'string' && typeof user.name === 'string'
    && typeof user.email === 'string' && typeof user.farmId === 'string'
    && (user.role === 'owner' || user.role === 'worker')
}

export function createMockAuthService({ delayMs = 400, storage = safeStorage, now = Date.now }: {
  delayMs?: number; storage?: SafeStorage; now?: () => number
} = {}): AuthService {
  const wait = () => delayMs === 0 ? Promise.resolve() : mockDelay(delayMs)
  const attempts = new Map<string, LoginAttempts>()

  async function readUsers(): Promise<StoredUser[]> {
    // Hash before reading so concurrent calls cannot overwrite a newly registered user.
    const passwordHash = await hashPassword(demoPassword)
    const stored = storage.getJson<StoredUser[]>(usersKey)
    if (Array.isArray(stored)) {
      return stored.map(user => ({
        ...user,
        username: typeof user.username === 'string' && user.username
          ? normalizeIdentifier(user.username)
          : demoAccounts.find(account => account.id === user.id)?.username ?? normalizeIdentifier(user.email.split('@')[0]),
      }))
    }
    const users = demoAccounts.map(user => ({ ...user, passwordHash }))
    storage.setJson(usersKey, users)
    return users
  }

  function saveSession(user: AuthUser): Session {
    const session: Session = {
      user: { id: user.id, username: user.username, name: user.name, email: user.email, role: user.role, farmId: user.farmId },
      issuedAt: new Date().toISOString(), source: 'mock',
    }
    storage.setJson(sessionKey, session)
    return session
  }

  function assertCanLogin(key: string) {
    const attempt = attempts.get(key)
    if (!attempt?.lockedUntil) return
    const remainingMs = attempt.lockedUntil - now()
    if (remainingMs <= 0) {
      attempts.delete(key)
      return
    }
    if (attempt.lockedUntil) throw new AuthError('rate_limited', { retryAfterMs: remainingMs })
  }

  function recordFailure(key: string): never {
    const failures = (attempts.get(key)?.failures ?? 0) + 1
    if (failures >= MAX_LOGIN_ATTEMPTS) {
      attempts.set(key, { failures: 0, lockedUntil: now() + LOGIN_COOLDOWN_MS })
      throw new AuthError('rate_limited', { retryAfterMs: LOGIN_COOLDOWN_MS })
    }
    attempts.set(key, { failures, lockedUntil: 0 })
    throw new AuthError('invalid_credentials')
  }

  return {
    async getSession() {
      const session = storage.getJson<unknown>(sessionKey)
      return isSession(session) ? session : null
    },
    async login(input) {
      await wait()
      const identifier = normalizeIdentifier(input.identifier)
      const users = await readUsers()
      const user = users.find(user => normalizeIdentifier(user.email) === identifier || normalizeIdentifier(user.username) === identifier)
      const attemptKey = user?.id ?? identifier
      assertCanLogin(attemptKey)
      const passwordHash = await hashPassword(input.password)
      if (!user || user.passwordHash !== passwordHash) recordFailure(attemptKey)
      attempts.delete(attemptKey)
      return saveSession(user)
    },
    async register(input) {
      await wait()
      const passwordHash = await hashPassword(input.password)
      const users = await readUsers()
      const email = normalizeIdentifier(input.email)
      const username = normalizeIdentifier(input.username)
      if (users.some(user => normalizeIdentifier(user.email) === email)) throw new AuthError('email_taken')
      if (users.some(user => normalizeIdentifier(user.username) === username)) throw new AuthError('username_taken')
      const user: StoredUser = {
        id: crypto.randomUUID(), username, name: input.name?.trim() || username, email, passwordHash,
        role: 'owner', farmId: 'farm-san-jose',
      }
      storage.setJson(usersKey, [...users, user])
      return saveSession(user)
    },
    async logout() {
      await wait()
      storage.remove(sessionKey)
    },
  }
}
