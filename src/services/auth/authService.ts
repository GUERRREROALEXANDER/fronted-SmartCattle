import { dataMode, type DataMode } from '../../api/config'
import { AuthError, type LoginInput, type RegisterInput, type Session } from '../../types/auth'
import { createMockAuthService } from './mockAuthService'

export interface AuthService {
  getSession(): Promise<Session | null>
  login(input: LoginInput): Promise<Session>
  register(input: RegisterInput): Promise<Session>
  logout(): Promise<void>
}

export function createAuthService(mode: DataMode = dataMode): AuthService {
  if (mode === 'api') return {
    getSession: async () => null,
    login: async () => { throw new AuthError('unavailable') },
    register: async () => { throw new AuthError('unavailable') },
    logout: async () => {},
  }
  return createMockAuthService()
}

export const authService = createAuthService()
