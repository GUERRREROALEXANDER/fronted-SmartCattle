import { useEffect, useRef, useState, type ReactNode } from 'react'
import { dataMode } from '../../api/config'
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
    void authService.getSession().catch(() => null).then(session => {
      if (active && current === revision.current) {
        setSession(session)
        setStatus(session ? 'authenticated' : 'anonymous')
      }
    })
    return () => { active = false }
  }, [])

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
  const value: AuthContextValue = {
    status, session, isDemo: dataMode !== 'api',
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
