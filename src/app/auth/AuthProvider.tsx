import { useEffect, useRef, useState, type ReactNode } from 'react'
import { dataMode } from '../../api/config'
import { can as roleCan } from '../../lib/permissions'
import { authService } from '../../services/auth/authService'
import { AuthError, type Session } from '../../types/auth'
import { AuthContext, type AuthContextValue } from './useAuth'

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null)
  const [status, setStatus] = useState<AuthContextValue['status']>('loading')
  const revision = useRef(0)

  useEffect(() => {
    let active = true
    const current = revision.current
    void authService.getSession().catch(() => null).then(restored => {
      if (active && current === revision.current) {
        setSession(restored)
        setStatus(restored ? 'authenticated' : 'anonymous')
      }
    })
    return () => { active = false }
  }, [])

  /**
   * Ends the session the moment its token does.
   *
   * Without this the session stays on screen after the token lapses and every
   * request starts failing with a 401, which reads as the server breaking
   * rather than as a session that ended. There is no refresh token, so expiry
   * is the end of the session.
   *
   * This only has to cover a session that expires while the tab is open: one
   * that was already expired never reaches state, because the auth service
   * refuses to restore it and clears it from storage instead.
   */
  const expiresAt = session?.expiresAt
  useEffect(() => {
    if (expiresAt === undefined) return
    const remaining = Date.parse(expiresAt) - Date.now()
    const endSession = () => {
      setSession(null)
      setStatus('anonymous')
    }
    // Clamped to the 32-bit maximum: setTimeout saturates above ~24.8 days and
    // fires immediately instead of never, which would sign the user out on
    // sight. Tokens last an hour so it cannot happen today, and a clamped
    // timer is a late sign-out rather than an instant one.
    const timer = setTimeout(endSession, Math.max(0, Math.min(remaining, 2_147_483_647)))
    return () => clearTimeout(timer)
  }, [expiresAt])

  async function authenticate(operation: () => Promise<Session>) {
    const current = ++revision.current
    try {
      const nextSession = await operation()
      if (current === revision.current) {
        setSession(nextSession)
        setStatus('authenticated')
      }
    } catch (error) {
      if (current === revision.current) setStatus(session ? 'authenticated' : 'anonymous')
      throw error instanceof AuthError ? error : new AuthError('storage')
    }
  }

  const role = session?.user.role ?? null
  const value: AuthContextValue = {
    status,
    session,
    // From the session, not the data mode: hybrid authenticates against the
    // backend now, so the mode no longer answers "is this session real".
    isDemo: session !== null && session.source !== 'api',
    // From the mode, because the sign-in form asks this before there is a
    // session to ask about.
    isDemoMode: dataMode === 'mock',
    role,
    can: permission => role !== null && roleCan(role, permission),
    login: input => authenticate(() => authService.login(input)),
    register: input => authenticate(() => authService.register(input)),
    async logout() {
      const current = ++revision.current
      try { await authService.logout() }
      finally {
        if (current === revision.current) {
          setSession(null)
          setStatus('anonymous')
        }
      }
    },
  }
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}
