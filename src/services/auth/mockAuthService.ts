// DEVELOPMENT MOCK AUTH. Not secure, not backend data. Replace when the backend provides authentication.
import { safeStorage, type SafeStorage } from '../../lib/safeStorage'
import { demoAccounts, demoPassword } from '../../mocks/mockAuth'
import { AuthError, type AuthUser, type Session } from '../../types/auth'
import { mockDelay } from '../dataSource'
import type { AuthService } from './authService'

const usersKey = 'smartcattle.demo.users'
const sessionKey = 'smartcattle.demo.session'
interface StoredUser extends AuthUser { passwordHash: string }

export async function hashPassword(password: string): Promise<string> {
  try {
    const hash = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(password))
    return Array.from(new Uint8Array(hash), byte => byte.toString(16).padStart(2, '0')).join('')
  } catch { throw new AuthError('unavailable') }
}

const normalizeEmail = (email: string) => email.trim().toLowerCase()

function isSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false
  const { user, issuedAt, source } = value as Partial<Session>
  return source === 'mock' && typeof issuedAt === 'string' && !Number.isNaN(Date.parse(issuedAt))
    && !!user && typeof user.id === 'string' && typeof user.name === 'string'
    && typeof user.email === 'string' && typeof user.farmId === 'string'
    && (user.role === 'owner' || user.role === 'worker')
}

export function createMockAuthService({ delayMs = 400, storage = safeStorage }: {
  delayMs?: number; storage?: SafeStorage
} = {}): AuthService {
  const wait = () => delayMs === 0 ? Promise.resolve() : mockDelay(delayMs)

  async function readUsers(): Promise<StoredUser[]> {
    // Hash before reading so concurrent calls cannot overwrite a newly registered user.
    const passwordHash = await hashPassword(demoPassword)
    const stored = storage.getJson<StoredUser[]>(usersKey)
    if (Array.isArray(stored)) return stored
    const users = demoAccounts.map(user => ({ ...user, passwordHash }))
    storage.setJson(usersKey, users)
    return users
  }

  function saveSession(user: AuthUser): Session {
    const session: Session = {
      user: { id: user.id, name: user.name, email: user.email, role: user.role, farmId: user.farmId },
      issuedAt: new Date().toISOString(), source: 'mock',
    }
    storage.setJson(sessionKey, session)
    return session
  }

  return {
    async getSession() {
      await wait()
      const session = storage.getJson<unknown>(sessionKey)
      return isSession(session) ? session : null
    },
    async login(input) {
      await wait()
      const passwordHash = await hashPassword(input.password)
      const users = await readUsers()
      const user = users.find(user => normalizeEmail(user.email) === normalizeEmail(input.email))
      if (!user || user.passwordHash !== passwordHash) throw new AuthError('invalid_credentials')
      return saveSession(user)
    },
    async register(input) {
      await wait()
      const passwordHash = await hashPassword(input.password)
      const users = await readUsers()
      const email = normalizeEmail(input.email)
      if (users.some(user => normalizeEmail(user.email) === email)) throw new AuthError('email_taken')
      const user: StoredUser = {
        id: crypto.randomUUID(), name: input.name.trim(), email, passwordHash,
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
