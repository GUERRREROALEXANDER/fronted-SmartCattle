import { CircleCheck, CircleDashed, Clock3, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Skeleton } from '../../components/ui'
import { formatTime } from '../../lib/format'
import { duration, ease, staggerDelay } from '../../motion'
import type { Camera, SystemStatus } from '../../types/domain'
import { onlineCameraCount, type FarmCondition } from './dashboardModel'
import styles from './FarmStatusHeader.module.css'

interface FarmStatusHeaderProps {
  farmName: string | null
  condition: FarmCondition
  headline: string | null
  status: SystemStatus | null
  cameras: Camera[] | null
  /** Number of cameras that deliver a picture; null while unknown. */
  withVideo: number | null
  /** When the dashboard data last arrived; null while the first load is pending. */
  updatedAt?: Date | null
}

type PillTone = 'safe' | 'warning' | 'critical' | 'inactive'

const pillIcon: Record<PillTone, LucideIcon> = {
  safe: CircleCheck, warning: TriangleAlert, critical: OctagonAlert, inactive: CircleDashed,
}

interface Pill { tone: PillTone; label: string }

export function FarmStatusHeader({ farmName, condition, headline, status, cameras, withVideo, updatedAt = null }: FarmStatusHeaderProps) {
  const reduce = useReducedMotion()
  const offline = status?.backend === 'offline'
  const pills = [backendPill(status), aiPill(status), camerasPill(cameras, offline, withVideo)]
  return <header className={styles.header}>
    <div className={styles.titleBlock}>
      <p className={styles.eyebrow}>Panel de la finca</p>
      <h1 className={styles.headline}>
        <span className={styles.farm}>{farmName ?? 'Tu finca'}</span>
        <span className={styles.separator} aria-hidden="true"> · </span>
        {headline
          ? <span className={styles[condition]}>{headline}</span>
          : <Skeleton width="14ch" height="0.9em" className={styles.skeleton} />}
      </h1>
      <ul className={styles.system} aria-label="Estado del sistema">
        {pills.map((pill, index) => {
          const Icon = pillIcon[pill.tone]
          return <motion.li key={index} className={`${styles.pill} ${styles[`pill-${pill.tone}`]}`}
            initial={{ opacity: 0, y: reduce ? 0 : 6 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: reduce ? duration.micro : duration.state, ease: ease.out, delay: reduce ? 0 : staggerDelay(index + 1) }}>
            <Icon size={14} strokeWidth={2.25} aria-hidden="true" />
            {pill.label}
          </motion.li>
        })}
      </ul>
    </div>
    <p className={styles.updated} aria-live="off">
      <Clock3 size={14} strokeWidth={2} aria-hidden="true" />
      {updatedAt
        ? <>Actualizado <time className="tabular" dateTime={updatedAt.toISOString()}>{formatTime(updatedAt)}</time></>
        : 'Cargando datos…'}
    </p>
  </header>
}

function backendPill(status: SystemStatus | null): Pill {
  if (!status) return { tone: 'inactive', label: 'Servidor: comprobando' }
  if (status.backend === 'online') return { tone: 'safe', label: 'Servidor en línea' }
  if (status.backend === 'offline') return { tone: 'critical', label: 'Servidor sin conexión' }
  return { tone: 'inactive', label: 'Servidor: modo demostración' }
}

function aiPill(status: SystemStatus | null): Pill {
  // The API only reports whether an AI URL is configured, not whether the service is up.
  if (!status || status.backend === 'not-checked' || status.aiConfigured === null) return { tone: 'inactive', label: 'Visión: sin datos' }
  return status.aiConfigured
    ? { tone: 'safe', label: 'Visión configurada' }
    : { tone: 'warning', label: 'Visión sin configurar' }
}

function camerasPill(cameras: Camera[] | null, offline: boolean, withVideo: number | null): Pill {
  // With the server offline the camera states are only the last known ones.
  if (!cameras || offline) return { tone: 'inactive', label: 'Cámaras: sin datos' }
  const online = onlineCameraCount(cameras)
  const video = withVideo === null ? '' : ` · ${withVideo} con video`
  const tone = online === 0 ? 'critical' : online < cameras.length || (withVideo !== null && withVideo < online) ? 'warning' : 'safe'
  return { tone, label: `Cámaras ${online}/${cameras.length} conectadas${video}` }
}
