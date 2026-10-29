import { useEffect, useRef, useState, type ReactNode } from 'react'
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
   * Signs the user out when the access token lapses.
   *
   * Without this the session stays on screen after its token expires and
   * every request starts failing with a 401, which reads as the server
   * breaking rather than as a session that ended. There is no refresh token,
   * so expiry is the end of the session.
   */
  useEffect(() => {
    if (!session?.expiresAt) return
    const remaining = Date.parse(session.expiresAt) - Date.now()
    if (remaining <= 0) {
      setSession(null)
      setStatus('anonymous')
      return
    }
    // setTimeout saturates above ~24.8 days, firing immediately instead of
    // never. Tokens last an hour, but clamping costs nothing and a clamped
    // timer is a late sign-out rather than an instant one.
    const timer = setTimeout(() => {
      setSession(null)
      setStatus('anonymous')
    }, Math.min(remaining, 2_147_483_647))
    return () => clearTimeout(timer)
  }, [session?.expiresAt])

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
