import { Loader2 } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router'
import type { UserRole } from '../../types/domain'
import { useAuth } from './useAuth'
import styles from './RequireAuth.module.css'

/**
 * Guards the authenticated routes, and optionally a role.
 *
 * The role check here is navigation only. The backend enforces it on every
 * write, which is what actually protects anything: a guard in the browser is a
 * courtesy that keeps someone off a page they cannot use, not a control.
 */
export function RequireAuth({ role }: { role?: UserRole } = {}) {
  const { status, session } = useAuth()
  const location = useLocation()

  if (status === 'loading') return <div className={styles.loading} role="status">
    <Loader2 className={styles.spinner} aria-hidden="true" />
    <span className="visually-hidden">Cargando sesión</span>
  </div>
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />
  // Redirected rather than shown an error: the user is signed in and simply
  // cannot be here, and the dashboard is somewhere they can be.
  if (role && session?.user.role !== role) return <Navigate to="/" replace />
  return <Outlet />
}
