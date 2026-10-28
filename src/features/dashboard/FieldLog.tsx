import { ArrowRight, CircleCheck, Info, NotebookPen, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Link } from 'react-router'
import { EmptyState, ErrorState, GlassCard, Notice, SkeletonText } from '../../components/ui'
import { describeApiError } from '../../api/errors'
import { detectedObjectLabel, eventCatalog, severityLabel } from '../../lib/eventCatalog'
import { formatConfidence, formatRelative, formatTime } from '../../lib/format'
import type { ResourceState } from '../../lib/useResource'
import { duration, ease, staggerDelay } from '../../motion'
import type { SecurityHours } from '../../services'
import type { Camera, FarmEvent, Severity } from '../../types/domain'
import { bandHourMarks, bandPosition, cameraName, restrictedSegments } from './dashboardModel'
import styles from './FieldLog.module.css'

const severityIcon: Record<Severity, LucideIcon> = { info: Info, warning: TriangleAlert, critical: OctagonAlert }

interface FieldLogProps {
  events: ResourceState<FarmEvent[]> & { reload: () => void }
  cameras: Camera[] | null
  securityHours: SecurityHours | null
  now: Date
  limit?: number
  className?: string
  /** Entrance delay of the card, in seconds. */
  delay?: number
}

export function FieldLog({ events, cameras, securityHours, now, limit = 5, className, delay }: FieldLogProps) {
  return <GlassCard as="section" padding="none" delay={delay} className={[styles.section, className].filter(Boolean).join(' ')}
    aria-labelledby="field-log-title">
    <div className={styles.heading}>
      <div className={styles.headingTitle}>
        <span className={styles.badge} aria-hidden="true"><NotebookPen size={18} strokeWidth={2} /></span>
        <h2 id="field-log-title" className={styles.title}>Bitácora</h2>
      </div>
      <Link className={styles.all} to="/events">Ver todos<span className="visually-hidden"> los eventos</span><ArrowRight size={16} strokeWidth={2} aria-hidden="true" /></Link>
    </div>
    {renderBody()}
  </GlassCard>

  function renderBody() {
    if (events.status === 'loading') return <SkeletonText lines={5} />
    if (events.status === 'error' && !events.data) {
      return <ErrorState {...describeApiError(events.error)} onRetry={events.reload} />
    }
    const list = events.data ?? []
    const staleNotice = events.status === 'error' && events.data && <Notice className={styles.notice} tone="warning" title={describeApiError(events.error).title}>
      Se muestran los últimos eventos recibidos. Se reintenta automáticamente.
    </Notice>
    if (list.length === 0) {
      return <>{staleNotice}<EmptyState icon={CircleCheck} title="Sin eventos registrados"
        description="Cuando el sistema de visión detecte algo, aparecerá aquí." /></>
    }
    return <>
      {staleNotice}
      <DayBand events={list} securityHours={securityHours} now={now} />
      <EventList events={list.slice(0, limit)} cameras={cameras} now={now} />
    </>
  }
}

/** The latest events; new ones slide in at the top and push the rest down. */
function EventList({ events, cameras, now }: { events: FarmEvent[]; cameras: Camera[] | null; now: Date }) {
  const reduce = useReducedMotion()
  return <ol className={styles.list}>
    <AnimatePresence initial={true} mode="popLayout">
      {events.map((event, index) => {
        const Icon = severityIcon[event.severity]
        const details = [
          cameraName(cameras, event.cameraId),
          event.detectedObject && detectedObjectLabel(event.detectedObject),
          event.confidence !== null && `confianza ${formatConfidence(event.confidence)}`,
          formatRelative(event.occurredAt, now),
        ].filter(Boolean).join(' · ')
        return <motion.li key={event.id} className={`${styles.entry} ${styles[event.severity]}`}
          layout={!reduce}
          initial={{ opacity: 0, y: reduce ? 0 : -10, scale: reduce ? 1 : 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, scale: reduce ? 1 : 0.98 }}
          transition={{ duration: reduce ? duration.micro : duration.panel, ease: ease.out, delay: reduce ? 0 : staggerDelay(index) }}>
          <span className={styles.iconCircle}>
            <Icon size={16} strokeWidth={2.25} role="img" aria-label={severityLabel[event.severity]} />
          </span>
          <span className={styles.body}>
            <span className={styles.label}>{eventCatalog[event.kind].label}</span>
            <span className={styles.meta}>{details}</span>
          </span>
          <time className={`${styles.time} tabular`} dateTime={event.occurredAt.toISOString()}>{formatTime(event.occurredAt)}</time>
        </motion.li>
      })}
    </AnimatePresence>
  </ol>
}

/** The last 24 h drawn to true scale, with restricted hours shaded and one tick per event. */
function DayBand({ events, securityHours, now }: { events: FarmEvent[]; securityHours: SecurityHours | null; now: Date }) {
  const segments = securityHours ? restrictedSegments(now, securityHours.restrictedFrom, securityHours.restrictedTo) : []
  const ticks = events.flatMap(event => {
    const position = bandPosition(event.occurredAt, now)
    return position === null ? [] : [{ id: event.id, position, severity: event.severity }]
  })
  const hourMarks = [...bandHourMarks(now), { key: 'now', position: 1, label: 'Ahora' }]
  return <figure className={styles.band}>
    <div className={styles.track} role="img"
      aria-label={`${ticks.length} eventos en las últimas 24 horas${segments.length ? ', con horario restringido sombreado' : ''}`}>
      {segments.map(segment => <span key={segment.start} className={styles.restricted}
        style={{ left: `${segment.start * 100}%`, width: `${(segment.end - segment.start) * 100}%` }} />)}
      {ticks.map(tick => <span key={tick.id} className={`${styles.tick} ${styles[tick.severity]}`}
        style={{ left: `${tick.position * 100}%` }} />)}
    </div>
    <div className={styles.scale} aria-hidden="true">
      {hourMarks.map(mark => <span key={mark.key} className="tabular" style={{ left: `${mark.position * 100}%` }}>{mark.label}</span>)}
    </div>
    {segments.length > 0 && <figcaption className={styles.legend}>
      <span className={styles.legendSwatch} aria-hidden="true" />
      Horario restringido {String(securityHours!.restrictedFrom).padStart(2, '0')}:00–{String(securityHours!.restrictedTo).padStart(2, '0')}:00
    </figcaption>}
  </figure>
}
