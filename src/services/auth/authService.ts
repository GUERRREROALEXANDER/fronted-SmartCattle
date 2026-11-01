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
 * `api` and `hybrid` sign in against the backend; only `mock` keeps the demo accounts in the browser.
 */
export function createAuthService(mode: DataMode = dataMode): AuthService {
  return mode === 'mock' ? createMockAuthService() : createApiAuthService()
}

export const authService = createAuthService()
