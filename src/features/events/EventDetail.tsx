import { ImageOff, Moon, Video, X } from 'lucide-react'
import { Link } from 'react-router'
import { StatusPill } from '../../components/ui'
import { detectedObjectLabel, eventCatalog, severityLabel } from '../../lib/eventCatalog'
import { formatConfidence, formatRelative } from '../../lib/format'
import type { FarmEvent } from '../../types/domain'
import styles from './EventDetail.module.css'

const fullDate = new Intl.DateTimeFormat('es-CO', { dateStyle: 'full', timeStyle: 'medium', hour12: false })
const tone = { info: 'info', warning: 'warning', critical: 'critical' } as const

interface EventDetailProps {
  event: FarmEvent
  cameraLabel: string
  restricted: boolean
  now: Date
  onClose: () => void
  headingId: string
}

/** What happened, when, where, which camera, how severe and what evidence exists. */
export function EventDetail({ event, cameraLabel, restricted, now, onClose, headingId }: EventDetailProps) {
  const entry = eventCatalog[event.kind]
  const security = entry.category === 'security'
  return <div className={styles.detail}>
    <header className={styles.header}>
      <div className={styles.titles}>
        <StatusPill tone={tone[event.severity]} label={severityLabel[event.severity]} />
        <h2 id={headingId} className={styles.title}>{entry.label}</h2>
      </div>
      <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar detalle">
        <X size={20} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </header>

    {security && <p className={styles.caution}>
      La detección indica presencia, no intención. Verifica la cámara antes de actuar.
    </p>}

    <dl className={styles.facts}>
      <div><dt>Cuándo</dt><dd>
        <time dateTime={event.occurredAt.toISOString()}>{capitalize(fullDate.format(event.occurredAt))}</time>
        <span className={styles.sub}>{formatRelative(event.occurredAt, now)}</span>
      </dd></div>
      <div><dt>Cámara</dt><dd>{cameraLabel}</dd></div>
      {event.detectedObject && <div><dt>Objeto detectado</dt><dd>{detectedObjectLabel(event.detectedObject)}</dd></div>}
      {event.confidence !== null && <div><dt>Confianza</dt><dd className="tabular">{formatConfidence(event.confidence)}</dd></div>}
      {restricted && <div><dt>Horario</dt><dd className={styles.restricted}>
        <Moon size={16} strokeWidth={1.75} aria-hidden="true" />Durante horario restringido
      </dd></div>}
      <div><dt>Severidad</dt><dd>
        {severityLabel[event.severity]}
        <span className={styles.sub}>{event.severitySource === 'backend'
          ? 'Asignada por el servidor'
          : 'Estimada por la aplicación; el servidor aún no envía severidad'}</span>
      </dd></div>
    </dl>

    <section className={styles.evidence} aria-label="Evidencia">
      <ImageOff size={22} strokeWidth={1.5} aria-hidden="true" />
      <p>Sin evidencia adjunta. El servidor todavía no guarda imágenes de los eventos.</p>
    </section>

    <Link className={styles.verify} to={`/live?camera=${encodeURIComponent(event.cameraId)}`}>
      <Video size={18} strokeWidth={1.75} aria-hidden="true" />Ver cámara en vivo
    </Link>

    <p className={styles.meta}>
      Recibido <time dateTime={event.receivedAt.toISOString()}>{formatRelative(event.receivedAt, now)}</time> · ID <span className="tabular">{event.id}</span>
    </p>
  </div>
}

const capitalize = (text: string) => text.charAt(0).toUpperCase() + text.slice(1)
