import { Video } from 'lucide-react'
import { Link } from 'react-router'
import { Notice } from '../../components/ui'
import { eventCatalog } from '../../lib/eventCatalog'
import { formatRelative, formatTime } from '../../lib/format'
import type { Camera, FarmEvent } from '../../types/domain'
import { cameraName } from './dashboardModel'
import styles from './AlertStrip.module.css'

interface AlertStripProps {
  alerts: FarmEvent[]
  cameras: Camera[] | null
  now: Date
}

/** The most important recent alert, with a direct path to verify it on camera. */
export function AlertStrip({ alerts, cameras, now }: AlertStripProps) {
  const [top, ...rest] = alerts
  if (!top) return null
  const camera = cameraName(cameras, top.cameraId)
  return <Notice
    className={styles.strip}
    tone={top.severity === 'critical' ? 'critical' : 'warning'}
    title={`${eventCatalog[top.kind].label} · ${camera}`}
    action={<Link className={styles.verify} to={`/live?camera=${encodeURIComponent(top.cameraId)}`}>
      <Video size={18} strokeWidth={1.75} aria-hidden="true" />Verificar cámara
    </Link>}>
    <time dateTime={top.occurredAt.toISOString()} className="tabular">
      {formatTime(top.occurredAt)} · {formatRelative(top.occurredAt, now)}
    </time>
    {rest.length > 0 && <> · {rest.length === 1 ? '1 alerta más' : `${rest.length} alertas más`} en la última hora</>}
  </Notice>
}
