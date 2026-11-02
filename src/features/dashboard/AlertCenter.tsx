import { useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Check, CheckCheck, ChevronRight, Info, OctagonAlert, ShieldCheck, TriangleAlert, Video, type LucideIcon } from 'lucide-react'
import { Link } from 'react-router'
import { describeApiError } from '../../api/errors'
import { Button, GlassCard } from '../../components/ui'
import { eventCatalog } from '../../lib/eventCatalog'
import { formatRelative, formatTime } from '../../lib/format'
import { PulseRing } from '../../motion'
import type { Alert, Camera, Severity } from '../../types/domain'
import { cameraName, sortAlerts } from './dashboardModel'
import styles from './AlertCenter.module.css'

const VISIBLE = 4
const severityIcon: Record<Severity, LucideIcon> = { critical: OctagonAlert, warning: TriangleAlert, info: Info }
const severityText: Record<Severity, string> = { critical: 'Crítica', warning: 'Advertencia', info: 'Informativa' }
// Strong ease-out: a new alert arrives fast and settles; a handled one leaves the same way.
const ease = [0.23, 1, 0.32, 1] as const

type Action = 'acknowledge' | 'resolve'

export function AlertCenter({ alerts, cameras, now, onAction, reduceMotion, className, delay }: {
  /** Open and acknowledged alerts from the live state. */
  alerts: readonly Alert[]
  cameras: readonly Camera[]
  now: Date
  onAction: (id: string, action: Action) => Promise<unknown>
  reduceMotion: boolean
  className?: string
  delay?: number
}) {
  const [pending, setPending] = useState<{ id: string; action: Action } | null>(null)
  const [failure, setFailure] = useState<{ id: string; message: string } | null>(null)
  const sorted = sortAlerts(alerts)
  const visible = sorted.slice(0, VISIBLE)
  const open = alerts.filter(alert => alert.status === 'open')
  const critical = open.filter(alert => alert.severity === 'critical').length

  const act = async (id: string, action: Action) => {
    setPending({ id, action })
    setFailure(null)
    try {
      await onAction(id, action)
    } catch (error) {
      const { title, description } = describeApiError(error)
      setFailure({ id, message: `${title}. ${description}` })
    } finally {
      setPending(null)
    }
  }

  return <GlassCard as="section" padding="none" delay={delay}
    className={[styles.card, critical > 0 && styles.hot, className].filter(Boolean).join(' ')} aria-labelledby="alert-center-title">
    <header className={styles.header}>
      <div>
        <h2 id="alert-center-title" className={styles.title}>Centro de alertas</h2>
        <p className={styles.summary} aria-live="polite">
          {open.length === 0 ? 'Nada pendiente' : `${open.length} sin atender${critical > 0 ? ` · ${critical} críticas` : ''}`}
        </p>
      </div>
      <Link className={styles.all} to="/events">Historial<ChevronRight size={16} strokeWidth={2} aria-hidden="true" /></Link>
    </header>

    {sorted.length === 0
      ? <div className={styles.calm}>
        <ShieldCheck size={22} strokeWidth={1.75} aria-hidden="true" />
        <p>Sin alertas abiertas. La IA avisará aquí y con la sirena si algo pasa.</p>
      </div>
      : <ul className={styles.list}>
        <AnimatePresence initial={false}>
          {visible.map(alert => {
            const Icon = severityIcon[alert.severity]
            const hot = alert.status === 'open' && alert.severity === 'critical'
            const busy = pending?.id === alert.id
            const camera = alert.cameraId ? cameraName(cameras as Camera[], alert.cameraId) : null
            return <motion.li key={alert.id} layout={!reduceMotion}
              className={[styles.item, styles[alert.severity], alert.status !== 'open' && styles.handled].filter(Boolean).join(' ')}
              initial={{ opacity: 0, transform: reduceMotion ? 'none' : 'translateY(-6px) scale(0.98)' }}
              animate={{ opacity: 1, transform: 'translateY(0px) scale(1)' }}
              exit={{ opacity: 0, transform: reduceMotion ? 'none' : 'translateX(12px)' }}
              transition={{ duration: reduceMotion ? 0.12 : 0.22, ease }}>
              <PulseRing active={hot && !reduceMotion} className={styles.iconRing}>
                <span className={styles.icon}><Icon size={18} strokeWidth={2} aria-hidden="true" /></span>
              </PulseRing>
              <div className={styles.body}>
                <p className={styles.what}>
                  <span className={styles.level}>{severityText[alert.severity]}</span>
                  {alert.kind ? eventCatalog[alert.kind].label : alert.message}
                </p>
                <p className={styles.meta}>
                  {camera && <>{camera} · </>}
                  <time dateTime={alert.createdAt.toISOString()} className="tabular" title={formatTime(alert.createdAt)}>
                    {formatRelative(alert.createdAt, now)}
                  </time>
                  {alert.status === 'acknowledged' && <> · <strong className={styles.ack}>Reconocida</strong></>}
                </p>
                {failure?.id === alert.id && <p className={styles.error} role="alert">{failure.message}</p>}
              </div>
              <div className={styles.actions}>
                {alert.cameraId && <Link className={styles.watch} to={`/live?camera=${encodeURIComponent(alert.cameraId)}`}
                  aria-label={`Ver la cámara ${camera ?? ''}`}>
                  <Video size={16} strokeWidth={2} aria-hidden="true" />
                </Link>}
                {alert.status === 'open' && <Button size="sm" variant={hot ? 'danger' : 'secondary'} icon={Check}
                  loading={busy && pending?.action === 'acknowledge'} disabled={busy} onClick={() => act(alert.id, 'acknowledge')}>
                  Reconocer
                </Button>}
                <Button size="sm" variant="ghost" icon={CheckCheck}
                  loading={busy && pending?.action === 'resolve'} disabled={busy} onClick={() => act(alert.id, 'resolve')}>
                  Resolver
                </Button>
              </div>
            </motion.li>
          })}
        </AnimatePresence>
      </ul>}
    {sorted.length > VISIBLE && <p className={styles.more}>
      {sorted.length - VISIBLE === 1 ? 'Una alerta más' : `${sorted.length - VISIBLE} alertas más`} en el <Link to="/events">historial</Link>
    </p>}
  </GlassCard>
}
