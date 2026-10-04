import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './useAuth'

export function RedirectIfAuthenticated() {
  const { status } = useAuth()
  const location = useLocation()
  const state = location.state as { from?: { pathname?: string } } | null
  const pathname = state?.from?.pathname
  const destination = typeof pathname === 'string' && pathname.startsWith('/')
    && !pathname.startsWith('//') && pathname !== '/login' && pathname !== '/register' ? pathname : '/'
  if (status === 'authenticated') return <Navigate to={destination} replace />
  return <Outlet />
}
