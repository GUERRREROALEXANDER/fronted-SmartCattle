import type { ReactNode } from 'react'
import { Info, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { detectedObjectLabel, eventCatalog, severityLabel } from '../../lib/eventCatalog'
import { formatConfidence, formatRelative, formatTime } from '../../lib/format'
import { duration, ease, staggerDelay } from '../../motion'
import type { FarmEvent, Severity } from '../../types/domain'
import styles from './EventRow.module.css'

const severityIcon: Record<Severity, LucideIcon> = { info: Info, warning: TriangleAlert, critical: OctagonAlert }

interface EventRowProps {
  event: FarmEvent
  /** Display name for the event's camera; omit when the context already names the camera. */
  cameraLabel?: string
  now: Date
  /** Extra marker shown after the label, e.g. "Horario restringido". */
  badge?: ReactNode
  /** Makes the row a button that opens the event's detail. */
  onSelect?: (event: FarmEvent) => void
  selected?: boolean
  /** Stagger index for the mount animation; omit for an instant row. */
  index?: number
}

/** One event as a list row: time, severity icon, label and details. */
export function EventRow({ event, cameraLabel, now, badge, onSelect, selected = false, index = 0 }: EventRowProps) {
  const reduce = useReducedMotion()
  const Icon = severityIcon[event.severity]
  const details = [
    cameraLabel,
    event.detectedObject && detectedObjectLabel(event.detectedObject),
    event.confidence !== null && `confianza ${formatConfidence(event.confidence)}`,
    formatRelative(event.occurredAt, now),
  ].filter(Boolean).join(' · ')
  const content = <>
    <time className={`${styles.time} tabular`} dateTime={event.occurredAt.toISOString()}>{formatTime(event.occurredAt)}</time>
    <Icon className={styles.icon} size={18} strokeWidth={1.75} role="img" aria-label={severityLabel[event.severity]} />
    <span className={styles.body}>
      <span className={styles.label}>{eventCatalog[event.kind].label}{badge && <> {badge}</>}</span>
      <span className={styles.meta}>{details}</span>
    </span>
  </>
  return <motion.li className={`${styles.entry} ${styles[event.severity]} ${onSelect ? styles.interactive : ''}`}
    initial={{ opacity: 0, y: reduce ? 0 : 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: reduce ? duration.micro : duration.state, ease: ease.out, delay: reduce ? 0 : staggerDelay(index) }}>
    {onSelect
      ? <button type="button" className={`${styles.row} ${selected ? styles.selected : ''}`} aria-current={selected ? 'true' : undefined}
        onClick={() => onSelect(event)}>{content}</button>
      : <div className={styles.row}>{content}</div>}
  </motion.li>
}
