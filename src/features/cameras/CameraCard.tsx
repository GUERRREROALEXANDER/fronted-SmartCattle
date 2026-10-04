import { ChevronRight, TriangleAlert, VideoOff, WifiOff } from 'lucide-react'
import { Link } from 'react-router'
import { formatRelative } from '../../lib/format'
import type { Camera, FrameDetections, Severity, StreamSource } from '../../types/domain'
import { detectionSummaryText, summarizeDetections } from '../monitoring/monitoringModel'
import styles from './CameraCard.module.css'

interface CameraCardProps {
  camera: Camera
  stream: StreamSource | null
  frame: FrameDetections | null
  alert: Severity | undefined
  now: Date
}

const statusLabel: Record<Camera['status'], string> = {
  online: 'En línea', connecting: 'Conectando', offline: 'Sin conexión', error: 'Con error',
}

/** A camera is a real object, so it gets a card: picture, identity, state and one action. */
export function CameraCard({ camera, stream, frame, alert, now }: CameraCardProps) {
  const picture = stream && (stream.kind === 'image' || stream.kind === 'mjpeg') && camera.status === 'online' ? stream : null
  const summary = frame ? summarizeDetections(frame.detections) : null
  const unreachable = camera.status === 'offline' || camera.status === 'error'

  return <article className={`${styles.card} ${alert ? styles[alert] : ''}`} aria-labelledby={`camera-${camera.id}`}>
    <div className={styles.thumb}>
      {picture
        ? <img src={picture.url} alt="" loading="lazy" decoding="async" />
        : <div className={styles.placeholder}>
          {unreachable ? <WifiOff size={22} strokeWidth={1.5} aria-hidden="true" /> : <VideoOff size={22} strokeWidth={1.5} aria-hidden="true" />}
          <span>{unreachable ? 'Sin señal' : 'Sin transmisión'}</span>
        </div>}
      {alert && <span className={styles.alertBadge}>
        <TriangleAlert size={14} strokeWidth={2} aria-hidden="true" />Alerta reciente
      </span>}
    </div>

    <div className={styles.body}>
      <div className={styles.titleRow}>
        <h2 id={`camera-${camera.id}`} className={styles.name}>{camera.name}</h2>
        <span className={`${styles.status} ${styles[camera.status]}`}>
          <span className={styles.dot} aria-hidden="true" />{statusLabel[camera.status]}
        </span>
      </div>
      <dl className={styles.facts}>
        <div><dt>Zona</dt><dd>{camera.location}</dd></div>
        <div><dt>Última conexión</dt><dd>{camera.lastSeenAt ? formatRelative(camera.lastSeenAt, now) : 'Sin datos'}</dd></div>
        <div><dt>Detecciones</dt><dd className="tabular">
          {picture && summary ? detectionSummaryText(summary) : 'Sin imagen para analizar'}
        </dd></div>
      </dl>
      <Link className={styles.action} to={`/live?camera=${encodeURIComponent(camera.id)}`}>
        Ver en vivo<ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
      </Link>
    </div>
  </article>
}
