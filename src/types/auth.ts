import type { UserRole } from './domain'

export interface AuthUser { id: string; name: string; email: string; role: UserRole; farmId: string }
export interface Session { user: AuthUser; issuedAt: string /* ISO */; source: 'mock' }
export interface LoginInput { email: string; password: string }
export interface RegisterInput { name: string; email: string; password: string }
export type AuthErrorCode = 'invalid_credentials' | 'email_taken' | 'unavailable' | 'storage'

const messages: Record<AuthErrorCode, string> = {
  invalid_credentials: 'El correo o la contraseña no son correctos.',
  email_taken: 'Este correo ya está registrado.',
  unavailable: 'La autenticación no está disponible en el servidor.',
  storage: 'No se pudo guardar la sesión de demostración.',
}

export class AuthError extends Error {
  readonly code: AuthErrorCode

  constructor(code: AuthErrorCode) {
    super(messages[code])
    this.name = 'AuthError'
    this.code = code
  }
}
