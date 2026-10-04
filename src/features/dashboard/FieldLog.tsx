import { CircleCheck, Info, OctagonAlert, TriangleAlert, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { EmptyState, ErrorState, SkeletonText } from '../../components/ui'
import { detectedObjectLabel, eventCatalog } from '../../lib/eventCatalog'
import { formatConfidence, formatRelative, formatTime } from '../../lib/format'
import type { ResourceState } from '../../lib/useResource'
import type { SecurityHours } from '../../services'
import type { Camera, FarmEvent, Severity } from '../../types/domain'
import { bandHourMarks, bandPosition, cameraName, restrictedSegments } from './dashboardModel'
import styles from './FieldLog.module.css'

const severityIcon: Record<Severity, LucideIcon> = { info: Info, warning: TriangleAlert, critical: OctagonAlert }
const severityLabel: Record<Severity, string> = { info: 'Informativo', warning: 'Advertencia', critical: 'Crítico' }

interface FieldLogProps {
  events: ResourceState<FarmEvent[]> & { reload: () => void }
  cameras: Camera[] | null
  securityHours: SecurityHours | null
  now: Date
  limit?: number
}

export function FieldLog({ events, cameras, securityHours, now, limit = 5 }: FieldLogProps) {
  return <section className={styles.section} aria-labelledby="field-log-title">
    <div className={styles.heading}>
      <h2 id="field-log-title" className={styles.title}>Bitácora</h2>
      <Link className={styles.all} to="/events">Ver todos los eventos</Link>
    </div>
    {renderBody()}
  </section>

  function renderBody() {
    if (events.status === 'loading') return <SkeletonText lines={5} />
    if (events.status === 'error' && !events.data) {
      return <ErrorState description="Revisa la conexión con el servidor e inténtalo de nuevo." onRetry={events.reload} />
    }
    const list = events.data ?? []
    if (list.length === 0) {
      return <EmptyState icon={CircleCheck} title="Sin eventos registrados"
        description="Cuando el sistema de visión detecte algo, aparecerá aquí." />
    }
    return <>
      <DayBand events={list} securityHours={securityHours} now={now} />
      <ol className={styles.list}>
        {list.slice(0, limit).map(event => <LogEntry key={event.id} event={event} cameras={cameras} now={now} />)}
      </ol>
    </>
  }
}

function LogEntry({ event, cameras, now }: { event: FarmEvent; cameras: Camera[] | null; now: Date }) {
  const Icon = severityIcon[event.severity]
  const details = [
    cameraName(cameras, event.cameraId),
    event.detectedObject && detectedObjectLabel(event.detectedObject),
    event.confidence !== null && `confianza ${formatConfidence(event.confidence)}`,
  ].filter(Boolean).join(' · ')
  return <li className={`${styles.entry} ${styles[event.severity]}`}>
    <time className={`${styles.time} tabular`} dateTime={event.occurredAt.toISOString()}>{formatTime(event.occurredAt)}</time>
    <Icon className={styles.icon} size={18} strokeWidth={1.75} aria-label={severityLabel[event.severity]} />
    <div className={styles.body}>
      <p className={styles.label}>{eventCatalog[event.kind].label}</p>
      <p className={styles.meta}>{details} · {formatRelative(event.occurredAt, now)}</p>
    </div>
  </li>
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
