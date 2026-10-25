import { MonitorX } from 'lucide-react'
import { EmptyState, Skeleton } from '../../../components/ui'
import styles from './SceneFallback.module.css'

export interface SceneFallbackProps {
  reason: 'loading' | 'unsupported'
}

export function SceneFallback({ reason }: SceneFallbackProps) {
  if (reason === 'loading') {
    return (
      <div className={styles.fallback}>
        <p className="visually-hidden" role="status">Cargando la escena 3D…</p>
        <Skeleton className={styles.skeleton} height="100%" radius="0" />
      </div>
    )
  }

  return (
    <div className={`${styles.fallback} ${styles.unsupported}`} role="alert">
      <EmptyState
        icon={MonitorX}
        title="La vista 3D no está disponible"
        description="Este navegador o dispositivo no tiene WebGL activo. El estado de cada zona y el registro de salidas siguen disponibles junto a esta área."
      />
    </div>
  )
}
