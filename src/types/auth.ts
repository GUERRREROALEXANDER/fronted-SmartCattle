import type { UserRole } from './domain'

export interface AuthUser {
  id: string
  name: string
  email: string
  role: UserRole
  /**
   * Demo accounts only. The backend has no username: it signs in by email, so
   * a real session has nothing to put here.
   */
  username?: string
  /**
   * Demo accounts only. There is no farm entity in the backend yet -- one
   * deployment is one farm -- so a real session has no identifier to show.
   */
  farmId?: string
}

/** `source` says where the session came from, which decides what it can do. */
export interface Session {
  user: AuthUser
  issuedAt: string /* ISO */
  source: 'mock' | 'api'
  /**
   * Present only for an api session. Sent as a bearer token on every
   * authenticated request. Absent means the session is a demo one and the
   * backend will reject anything it is used for.
   */
  accessToken?: string
  /** ISO instant the token stops being accepted. Absent for a demo session. */
  expiresAt?: string
}

export interface LoginInput { identifier: string; password: string }
export interface RegisterInput { username?: string; name?: string; email: string; password: string }
export type AuthErrorCode =
  | 'invalid_credentials'
  | 'email_taken'
  | 'username_taken'
  | 'rate_limited'
  | 'unavailable'
  | 'storage'
  | 'password_too_long'
  | 'network'
  | 'server'

const messages: Record<AuthErrorCode, string> = {
  invalid_credentials: 'El usuario o la contraseña no son correctos.',
  email_taken: 'Este correo ya está registrado.',
  username_taken: 'Este usuario ya está registrado.',
  rate_limited: 'Demasiados intentos. Espera antes de volver a intentarlo.',
  unavailable: 'La autenticación no está disponible en el servidor.',
  storage: 'No se pudo guardar la sesión de demostración.',
  // bcrypt ignores everything past 72 bytes, so the backend rejects a longer
  // password rather than silently checking only its start. Accented letters
  // count as two bytes, which is why the message says bytes and not letters.
  password_too_long: 'La contraseña es demasiado larga (máximo 72 bytes; las letras acentuadas cuentan doble).',
  network: 'No se pudo contactar el servidor. Comprueba la conexión.',
  server: 'El servidor respondió con un error. Vuelve a intentarlo.',
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
