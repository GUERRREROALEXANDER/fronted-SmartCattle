import { dataMode, type DataMode } from '../../api/config'
import type { LoginInput, RegisterInput, Session } from '../../types/auth'
import { createApiAuthService } from './apiAuthService'
import { createMockAuthService } from './mockAuthService'

export interface AuthService {
  getSession(): Promise<Session | null>
  login(input: LoginInput): Promise<Session>
  register(input: RegisterInput): Promise<Session>
  logout(): Promise<void>
}

/**
 * Which authentication the app uses.
 *
 * `mock` keeps the demo accounts in this browser, so the app can be shown
 * without a server running. Everything else authenticates against the backend.
 *
 * `hybrid` used to fall back to the mock, which meant the deployed app -- which
 * runs in hybrid -- signed people in against unsalted SHA-256 hashes in
 * localStorage. Authentication is the one capability where falling back to a
 * demo is worse than failing: a session that is not real cannot protect
 * anything, and it looks exactly like one that is.
 */
export function createAuthService(mode: DataMode = dataMode): AuthService {
  return mode === 'mock' ? createMockAuthService() : createApiAuthService()
}

export const authService = createAuthService()
