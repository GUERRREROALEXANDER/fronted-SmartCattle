import { FlaskConical } from 'lucide-react'
import { dataMode } from '../../api/config'
import styles from './DataSourceBadge.module.css'

export function DataSourceBadge({ tone = 'default' }: { tone?: 'default' | 'on-brand' }) {
  if (dataMode === 'api') return null
  return <span className={`${styles.badge} ${tone === 'on-brand' ? styles.onBrand : ''}`}
    title="Parte de la información es simulada mientras el backend no la ofrezca.">
    <FlaskConical size={14} strokeWidth={1.75} aria-hidden="true" />
    <span>Datos de demostración</span>
  </span>
}
