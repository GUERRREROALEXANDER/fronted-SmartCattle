import { Info, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react'
import { detectedObjectLabel, eventCatalog, severityLabel } from '../../lib/eventCatalog'
import { formatConfidence, formatRelative, formatTime } from '../../lib/format'
import type { FarmEvent, Severity } from '../../types/domain'
import styles from './EventRow.module.css'

const severityIcon: Record<Severity, LucideIcon> = { info: Info, warning: TriangleAlert, critical: OctagonAlert }

interface EventRowProps {
  event: FarmEvent
  /** Display name for the event's camera; omit when the context already names the camera. */
  cameraLabel?: string
  now: Date
}

/** One event as a list row: time, severity icon, label and details. */
export function EventRow({ event, cameraLabel, now }: EventRowProps) {
  const Icon = severityIcon[event.severity]
  const details = [
    cameraLabel,
    event.detectedObject && detectedObjectLabel(event.detectedObject),
    event.confidence !== null && `confianza ${formatConfidence(event.confidence)}`,
    formatRelative(event.occurredAt, now),
  ].filter(Boolean).join(' · ')
  return <li className={`${styles.entry} ${styles[event.severity]}`}>
    <time className={`${styles.time} tabular`} dateTime={event.occurredAt.toISOString()}>{formatTime(event.occurredAt)}</time>
    <Icon className={styles.icon} size={18} strokeWidth={1.75} role="img" aria-label={severityLabel[event.severity]} />
    <div className={styles.body}>
      <p className={styles.label}>{eventCatalog[event.kind].label}</p>
      <p className={styles.meta}>{details}</p>
    </div>
  </li>
}
