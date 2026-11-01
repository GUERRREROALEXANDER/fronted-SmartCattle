import { Loader2 } from 'lucide-react'
import { Navigate, Outlet } from 'react-router'
import { useResource } from '../../lib/useResource'
import { getCurrentFarm } from '../../services'
import styles from './RequireAuth.module.css'

/**
 * Sends a signed-in person with no farm registered yet to the first-run setup. If the backend can't be
 * reached the app still opens: each page already explains what is missing.
 */
export function RequireFarm() {
  const farm = useResource(signal => getCurrentFarm({ signal }))
  if (farm.status === 'loading') return <div className={styles.loading} role="status">
    <Loader2 className={styles.spinner} aria-hidden="true" />
    <span className="visually-hidden">Cargando la finca</span>
  </div>
  if (farm.status === 'success' && farm.data === null) return <Navigate to="/setup" replace />
  return <Outlet />
}
