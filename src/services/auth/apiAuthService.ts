import { ApiError } from '../../api/errors'
import { getJson, postJson } from '../../api/httpClient'
import { parseTokenResponse, parseUser } from '../../api/parsers'
import { tokenStore as defaultTokenStore, type TokenStore } from '../../api/session'
import type { ApiUser } from '../../types/api'
import { AuthError, type AuthUser, type Session } from '../../types/auth'
import type { AuthService } from './authService'

export function toAuthUser(user: ApiUser): AuthUser {
  return {
    id: String(user.id), username: user.email.split('@')[0], name: user.full_name, email: user.email,
    role: user.role, farmId: null,
  }
}

function toAuthError(error: unknown): AuthError {
  if (error instanceof AuthError) return error
  if (error instanceof ApiError && error.kind === 'http') {
    // 422 is a malformed email: for the person it is the same as wrong credentials.
    if (error.status === 401 || error.status === 422) return new AuthError('invalid_credentials')
    if (error.status === 409) return new AuthError('email_taken')
    if (error.status === 429) return new AuthError('rate_limited', { retryAfterMs: error.retryAfterMs })
  }
  return new AuthError('unavailable')
}

/** Accounts and bearer tokens from the backend (POST /api/auth/login, /register, GET /api/auth/me). */
export function createApiAuthService({ fetchImpl, tokens = defaultTokenStore }: {
  fetchImpl?: typeof fetch; tokens?: TokenStore
} = {}): AuthService {
  function start(body: unknown): Session {
    const response = parseTokenResponse(body)
    tokens.set(response.access_token, response.expires_in)
    return { user: toAuthUser(response.user), issuedAt: new Date().toISOString(), source: 'api' }
  }

  return {
    async getSession() {
      const token = tokens.get()
      if (!token) return null
      try {
        const user = parseUser(await getJson<unknown>('/api/auth/me', { fetchImpl, token }))
        return { user: toAuthUser(user), issuedAt: new Date().toISOString(), source: 'api' }
      } catch (error) {
        // Only a rejected token ends the session; a backend that is down keeps it for the next try.
        if (error instanceof ApiError && error.status === 401) {
          tokens.clear()
          return null
        }
        throw error
      }
    },
    async login({ identifier, password }) {
      try {
        return start(await postJson<unknown>('/api/auth/login', { email: identifier.trim(), password }, { fetchImpl, token: null }))
      } catch (error) { throw toAuthError(error) }
    },
    async register({ username, name, email, password }) {
      try {
        return start(await postJson<unknown>('/api/auth/register', {
          email: email.trim(), password, full_name: name?.trim() || username.trim(),
        }, { fetchImpl, token: null }))
      } catch (error) { throw toAuthError(error) }
    },
    async logout() {
      // The backend has no logout endpoint: tokens simply expire, so forgetting it is the sign-out.
      tokens.clear()
    },
  }
}
