import { Loader2 } from 'lucide-react'
import { Navigate, Outlet, useLocation } from 'react-router'
import { useResource } from '../../lib/useResource'
import { getCurrentFarm, listSavedCameras, type SavedCamera } from '../../services'
import { useAuth } from './useAuth'
import { cameraSetupSkipped } from './cameraSetupSkip'
import styles from './RequireAuth.module.css'

const CAMERAS = '/cameras'

/**
 * What a signed-in person sees first: the Cameras page, until their account has one, and then the farm's setup. If
 * the backend can't be reached the app still opens: each page already explains what is missing.
 */
export function RequireFarm() {
  const { can } = useAuth()
  const { pathname } = useLocation()
  const configures = can('cameras:configure')
  const farm = useResource(signal => getCurrentFarm({ signal }))
  const saved = useResource<SavedCamera[] | null>(signal => configures ? listSavedCameras({ signal }) : Promise.resolve({ source: 'api', data: null }))
  if (farm.status === 'loading' || saved.status === 'loading') return <div className={styles.loading} role="status">
    <Loader2 className={styles.spinner} aria-hidden="true" />
    <span className="visually-hidden">Cargando la finca</span>
  </div>
  const noCameras = saved.status === 'success' && saved.data?.length === 0 && !cameraSetupSkipped()
  const noFarm = farm.status === 'success' && farm.data === null
  if (pathname !== CAMERAS) {
    if (noCameras && (noFarm || pathname === '/')) return <Navigate to={CAMERAS} replace />
    if (noFarm) return <Navigate to="/setup" replace />
  }
  return <Outlet />
}
