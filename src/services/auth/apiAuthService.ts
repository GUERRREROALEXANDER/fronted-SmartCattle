// Real authentication against the backend. The mock in mockAuthService stays
// for VITE_DATA_SOURCE=mock, so the app still demonstrates without a server.
import { ApiError } from '../../api/errors'
import { getJson, postJson } from '../../api/httpClient'
import { SESSION_STORAGE_KEY } from '../../api/session'
import { safeStorage, type SafeStorage } from '../../lib/safeStorage'
import { AuthError, type AuthErrorCode, type Session } from '../../types/auth'
import type { UserRole } from '../../types/domain'
import type { AuthService } from './authService'

// The same key api/session.ts reads. Two literals would let the writer and
// the readers drift apart, and the symptom would be an app that signs in and
// then sends every request anonymously.
const sessionKey = SESSION_STORAGE_KEY

/** What POST /api/auth/login and /register return. */
interface ApiTokenResponse {
  access_token: string
  token_type: string
  expires_in: number
  user: ApiUser
}

interface ApiUser {
  id: number
  email: string
  full_name: string
  role: string
  is_active: boolean
  created_at: string
  last_login_at: string | null
}

function isRole(value: unknown): value is UserRole {
  return value === 'owner' || value === 'worker'
}

function parseUser(body: unknown): ApiUser {
  if (!body || typeof body !== 'object') throw new AuthError('server')
  const user = body as Partial<ApiUser>
  if (typeof user.id !== 'number' || typeof user.email !== 'string'
    || typeof user.full_name !== 'string' || !isRole(user.role)) {
    // A response we cannot read is a server problem, not a credentials
    // problem: saying "wrong password" here would send the user in circles.
    throw new AuthError('server')
  }
  return user as ApiUser
}

/**
 * Builds a session from a token response.
 *
 * `expiresAt` is computed from `expires_in` against the browser clock. That is
 * a deliberate approximation: it is only used to avoid sending a token the
 * backend will certainly reject, and the backend remains the authority. A
 * skewed browser clock makes the app refresh slightly early or late, never
 * wrong.
 */
function toSession(body: unknown, now: Date): Session {
  if (!body || typeof body !== 'object') throw new AuthError('server')
  const payload = body as Partial<ApiTokenResponse>
  if (typeof payload.access_token !== 'string' || !payload.access_token) throw new AuthError('server')
  const user = parseUser(payload.user)
  const lifetimeMs = typeof payload.expires_in === 'number' && payload.expires_in > 0
    ? payload.expires_in * 1000
    : 0
  return {
    user: {
      id: String(user.id),
      name: user.full_name,
      email: user.email,
      role: user.role as UserRole,
      // No username and no farmId: the backend has neither.
    },
    issuedAt: now.toISOString(),
    source: 'api',
    accessToken: payload.access_token,
    ...(lifetimeMs > 0 ? { expiresAt: new Date(now.getTime() + lifetimeMs).toISOString() } : {}),
  }
}

/** Maps a backend failure onto a message the farm staff can act on. */
function toAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) return error
  if (!(error instanceof ApiError)) return new AuthError('server')
  if (error.kind === 'network' || error.kind === 'timeout') return new AuthError('network')

  const byStatus: Partial<Record<number, AuthErrorCode>> = {
    // The backend answers the same 401 for a wrong password, an unknown
    // address and a deactivated account, on purpose. Showing one message is
    // not a loss of detail: there is no detail to show.
    401: 'invalid_credentials',
    409: 'email_taken',
    // Authentication is switched off on this deployment: JWT_SECRET is unset.
    503: 'unavailable',
  }
  if (error.status === 429) {
    return new AuthError('rate_limited')
  }
  if (error.status === 422) {
    // The only 422 a correct client can provoke is the bcrypt byte limit,
    // because the form validates everything else first.
    const tooLong = error.detail?.includes('72 bytes') ?? false
    return new AuthError(tooLong ? 'password_too_long' : 'server')
  }
  const code = error.status === undefined ? undefined : byStatus[error.status]
  return new AuthError(code ?? 'server')
}

function isStoredSession(value: unknown): value is Session {
  if (!value || typeof value !== 'object') return false
  const { user, issuedAt, source, accessToken } = value as Partial<Session>
  return source === 'api' && typeof accessToken === 'string' && !!accessToken
    && typeof issuedAt === 'string' && !Number.isNaN(Date.parse(issuedAt))
    && !!user && typeof user.id === 'string' && typeof user.name === 'string'
    && typeof user.email === 'string' && isRole(user.role)
}

export interface ApiAuthOptions {
  storage?: SafeStorage
  now?: () => Date
  fetchImpl?: typeof fetch
  /**
   * Which backend to talk to. Defaults to the configured one.
   *
   * Every other service accepts this, and leaving it out here meant the auth
   * service could only ever reach VITE_API_BASE_URL -- so an integration run
   * pointed at a second backend signed in against the first without saying
   * so, which is a confusing way to fail.
   */
  baseUrl?: string
}

export function createApiAuthService({
  storage = safeStorage, now = () => new Date(), fetchImpl, baseUrl,
}: ApiAuthOptions = {}): AuthService {
  const options = {
    ...(fetchImpl ? { fetchImpl } : {}),
    ...(baseUrl ? { baseUrl } : {}),
  }

  const persist = (session: Session): Session => {
    storage.setJson(sessionKey, session)
    return session
  }

  return {
    async getSession() {
      const stored = storage.getJson<unknown>(sessionKey)
      if (!isStoredSession(stored)) return null
      // Expired by the browser clock: drop it without a request. The token is
      // certainly rejected, and asking anyway turns every page load after a
      // lapsed session into a failed request.
      if (stored.expiresAt && Date.parse(stored.expiresAt) <= now().getTime()) {
        storage.remove(sessionKey)
        return null
      }
      try {
        // Confirmed against the backend rather than trusted: the account may
        // have been deactivated, or the deployment's signing secret replaced,
        // either of which leaves a well-formed token that no longer works.
        await getJson<unknown>('/api/auth/me', {
          ...options, headers: { Authorization: `Bearer ${stored.accessToken}` },
        })
        return stored
      } catch (error) {
        if (error instanceof ApiError && error.status === 401) {
          storage.remove(sessionKey)
          return null
        }
        // A network failure is not a signed-out user. Keeping the session lets
        // the app come back when the connection does, instead of logging
        // somebody out because the farm's link dropped for a moment.
        return stored
      }
    },

    async login(input) {
      try {
        const body = await postJson<unknown>('/api/auth/login', {
          email: input.identifier.trim().toLowerCase(),
          password: input.password,
        }, options)
        return persist(toSession(body, now()))
      } catch (error) {
        throw toAuthError(error)
      }
    },

    async register(input) {
      try {
        const body = await postJson<unknown>('/api/auth/register', {
          email: input.email.trim().toLowerCase(),
          password: input.password,
          // The backend requires a name. The form makes it optional, so the
          // address is the fallback rather than an empty string, which it
          // would reject.
          full_name: input.name?.trim() || input.email.trim(),
        }, options)
        return persist(toSession(body, now()))
      } catch (error) {
        throw toAuthError(error)
      }
    },

    async logout() {
      // No endpoint to call: the backend has no revocation list, so signing
      // out is dropping the token locally. Said plainly here because the
      // absence looks like an oversight otherwise.
      storage.remove(sessionKey)
    },
  }
}
