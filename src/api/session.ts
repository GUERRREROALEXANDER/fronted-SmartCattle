import { safeStorage, type SafeStorage } from '../lib/safeStorage'

/** Bearer token issued by POST /api/auth/login or /register. */
export interface StoredToken { accessToken: string; expiresAt: number }

const tokenKey = 'smartcattle.api.token'

function isStoredToken(value: unknown): value is StoredToken {
  if (!value || typeof value !== 'object') return false
  const { accessToken, expiresAt } = value as Partial<StoredToken>
  return typeof accessToken === 'string' && accessToken.length > 0 && typeof expiresAt === 'number' && Number.isFinite(expiresAt)
}

export interface TokenStore {
  /** The current token, or null when there is none or it has expired. */
  get(): string | null
  set(accessToken: string, expiresInSeconds: number): void
  clear(): void
  /** Called when the backend rejects the token (HTTP 401 or WebSocket 4401). */
  onRejected(listener: () => void): () => void
  reject(): void
}

export function createTokenStore(storage: SafeStorage = safeStorage, now: () => number = Date.now): TokenStore {
  const listeners = new Set<() => void>()
  return {
    get() {
      const stored = storage.getJson<unknown>(tokenKey)
      if (!isStoredToken(stored)) return null
      if (stored.expiresAt <= now()) {
        storage.remove(tokenKey)
        return null
      }
      return stored.accessToken
    },
    set(accessToken, expiresInSeconds) {
      storage.setJson<StoredToken>(tokenKey, { accessToken, expiresAt: now() + Math.max(0, expiresInSeconds) * 1000 })
    },
    clear() { storage.remove(tokenKey) },
    onRejected(listener) {
      listeners.add(listener)
      return () => { listeners.delete(listener) }
    },
    reject() {
      storage.remove(tokenKey)
      for (const listener of [...listeners]) listener()
    },
  }
}

export const tokenStore = createTokenStore()
