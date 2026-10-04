import { createContext, useContext } from 'react'
import type { LoginInput, RegisterInput, Session } from '../../types/auth'

export interface AuthContextValue {
  status: 'loading' | 'authenticated' | 'anonymous'
  session: Session | null
  login(input: LoginInput): Promise<void>
  register(input: RegisterInput): Promise<void>
  logout(): Promise<void>
  isDemo: boolean
}
export const AuthContext = createContext<AuthContextValue | null>(null)
export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth must be used within AuthProvider')
  return context
}
