/**
 * Where the rest of the app reads the access token.
 *
 * The session lives in storage because it has to survive a reload, and every
 * authenticated request needs the token out of it. Reading it through this
 * module rather than importing the auth service avoids a cycle -- the services
 * would import the auth service, which imports the http client, which the
 * services also use -- and keeps exactly one place that knows the storage key.
 */
import { safeStorage, type SafeStorage } from '../lib/safeStorage'
import type { Session } from '../types/auth'

export const SESSION_STORAGE_KEY = 'smartcattle.session'

function isUsable(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false
  const { source, accessToken } = value as Partial<Session>
  return source === 'api' && typeof accessToken === 'string' && accessToken.length > 0
}

/**
 * The bearer token for the current session, or null.
 *
 * Null for a demo session as well as for no session: a demo session carries no
 * token, and sending an empty Authorization header would turn a 401 into a
 * confusing 422 from the header parser.
 */
export function readAccessToken(storage: SafeStorage = safeStorage): string | null {
  const stored = storage.getJson<unknown>(SESSION_STORAGE_KEY)
  return isUsable(stored) ? stored.accessToken! : null
}

/**
 * Authorization header for the current session, or nothing.
 *
 * Spread into request options: `{ ...options, headers: authHeaders() }`. An
 * empty object rather than a header with no value, so an anonymous request
 * stays anonymous instead of carrying something the backend has to reject.
 */
export function authHeaders(storage: SafeStorage = safeStorage): Record<string, string> {
  const token = readAccessToken(storage)
  return token ? { Authorization: `Bearer ${token}` } : {}
}
