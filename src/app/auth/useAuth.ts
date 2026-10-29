import { createContext, useContext } from 'react'
import type { LoginInput, RegisterInput, Session, UserRole } from '../../types/auth'
import type { Permission } from '../../lib/permissions'

export interface AuthContextValue {
  status: 'loading' | 'authenticated' | 'anonymous'
  session: Session | null
  login(input: LoginInput): Promise<void>
  register(input: RegisterInput): Promise<void>
  logout(): Promise<void>
  /**
   * True while the session is a local demo one.
   *
   * Read from the session rather than from the configured data mode. The two
   * used to be the same thing; now hybrid authenticates against the backend,
   * so the mode no longer says whether the signed-in session is real -- and
   * what the interface needs to know is whether a write will reach a server.
   */
  isDemo: boolean
  /** The signed-in user's role, or null when nobody is signed in. */
  role: UserRole | null
  /**
   * Whether the current user may do something, for hiding controls.
   *
   * Interface gating only. The backend enforces the same rules on every
   * write, which is what protects anything: hiding a button stops a mistake,
   * not an attacker.
   */
  can(permission: Permission): boolean
}
export const AuthContext = createContext<AuthContextValue | null>(null)
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
