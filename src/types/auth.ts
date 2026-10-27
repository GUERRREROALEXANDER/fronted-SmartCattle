import type { UserRole } from './domain'

export interface AuthUser { id: string; username: string; name: string; email: string; role: UserRole; farmId: string }
export interface Session { user: AuthUser; issuedAt: string /* ISO */; source: 'mock' }
export interface LoginInput { identifier: string; password: string }
export interface RegisterInput { username: string; name?: string; email: string; password: string }
export type AuthErrorCode = 'invalid_credentials' | 'email_taken' | 'username_taken' | 'rate_limited' | 'unavailable' | 'storage'

const messages: Record<AuthErrorCode, string> = {
  invalid_credentials: 'El usuario o la contraseña no son correctos.',
  email_taken: 'Este correo ya está registrado.',
  username_taken: 'Este usuario ya está registrado.',
  rate_limited: 'Demasiados intentos. Espera antes de volver a intentarlo.',
  unavailable: 'La autenticación no está disponible en el servidor.',
  storage: 'No se pudo guardar la sesión de demostración.',
}

export class AuthError extends Error {
  readonly code: AuthErrorCode
  readonly retryAfterMs?: number

  constructor(code: AuthErrorCode, { retryAfterMs }: { retryAfterMs?: number } = {}) {
    super(messages[code])
    this.name = 'AuthError'
    this.code = code
    this.retryAfterMs = retryAfterMs
  }
}
