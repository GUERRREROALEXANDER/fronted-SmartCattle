import { Loader2 } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useAuth } from './useAuth'
import styles from './RequireAuth.module.css'

export function RequireAuth() {
  const { status } = useAuth()
  const location = useLocation()
  if (status === 'loading') return <div className={styles.loading} role="status">
    <Loader2 className={styles.spinner} aria-hidden="true" />
    <span className="visually-hidden">Cargando sesión</span>
  </div>
  if (status === 'anonymous') return <Navigate to="/login" replace state={{ from: location }} />
  return <Outlet />
}
