import { Navigate, Outlet, useLocation } from 'react-router'
import { onboardingOf } from '../../features/onboarding/onboardingModel'
import { useAuth } from './useAuth'

export function RedirectIfAuthenticated() {
  const { status, session } = useAuth()
  const location = useLocation()
  const state = location.state as { from?: { pathname?: string } } | null
  const pathname = state?.from?.pathname
  // Where they asked to go, or else the page they chose to start on.
  const start = (session && onboardingOf(session.user.id)?.start) ?? '/'
  const destination = typeof pathname === 'string' && pathname.startsWith('/')
    && !pathname.startsWith('//') && pathname !== '/login' && pathname !== '/register' ? pathname : start
  if (status === 'authenticated') return <Navigate to={destination} replace />
  return <Outlet />
}
