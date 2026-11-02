import { createContext, useContext } from 'react'
import type { LoginInput, RegisterInput, Session } from '../../types/auth'
import type { UserRole } from '../../types/domain'
import type { Permission } from '../../lib/permissions'

export interface AuthContextValue {
  status: 'loading' | 'authenticated' | 'anonymous'
  session: Session | null
  login(input: LoginInput): Promise<void>
  register(input: RegisterInput): Promise<void>
  logout(): Promise<void>
  /**
   * True while the signed-in session is a local demo one.
   *
   * Read from the session, not the configured mode. What the interface needs
   * here is whether a write will reach a server, and since hybrid now
   * authenticates against the backend the mode no longer answers that.
   *
   * False when nobody is signed in, which is why the sign-in form uses
   * `isDemoMode` instead: before signing in there is no session to describe.
   */
  isDemo: boolean
  /**
   * True when the app is configured to use demo accounts at all.
   *
   * A different question from `isDemo`, and the sign-in form needs this one:
   * whether to offer the demo accounts, which has to be answerable before
   * anybody has signed in.
   */
  isDemoMode: boolean
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
