import { BellRing, Cctv, ShieldAlert, ShieldCheck, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { GlassCard } from '../../components/ui'
import type { HerdCount, HerdPoint } from '../../live/liveState'
import { AnimatedNumber, DeltaChip, PulseRing, staggerDelay } from '../../motion'
import type { Alert, Camera, LiveMetrics as LiveMetricsData } from '../../types/domain'
import styles from './LiveMetrics.module.css'

type Tone = 'safe' | 'alarm' | 'info' | 'person'

function MetricCard({ icon: Icon, tone, label, delta, children, caption, index, pulse = false }: {
  icon: LucideIcon
  tone: Tone
  label: string
  delta?: ReactNode
  children: ReactNode
  caption: ReactNode
  index: number
  /** Pulses only while the state it reports needs attention right now. */
  pulse?: boolean
}) {
  return <GlassCard as="li" padding="none" delay={staggerDelay(index)} className={`${styles.card} ${styles[tone]}`}>
    <div className={styles.cardTop}>
      <PulseRing active={pulse} className={styles.iconRing}>
        <span className={styles.icon}><Icon size={20} strokeWidth={2} aria-hidden="true" /></span>
      </PulseRing>
      {delta && <span className={styles.delta}>{delta}</span>}
    </div>
    <p className={styles.label}>{label}</p>
    <p className={styles.value}>{children}</p>
    <p className={styles.caption}>{caption}</p>
  </GlassCard>
}

const unknown = <span className={styles.unknown}>—</span>

/** The four numbers a farmer checks first, all from the live backend state. */
export function LiveMetrics({ count, history, metrics, cameras, alerts, reduceMotion, className, staggerFrom = 0 }: {
  count: HerdCount | null
  history: readonly HerdPoint[]
  metrics: LiveMetricsData | null
  cameras: readonly Camera[]
  alerts: readonly Alert[]
  reduceMotion: boolean
  className?: string
  /** Stagger index of the first tile, so the page enters as one sequence. */
  staggerFrom?: number
}) {
  const first = history[0]
  const insidePercent = count && count.total > 0 ? Math.round(count.inside / count.total * 100) : null
  const online = cameras.filter(camera => camera.status === 'online').length
  const failing = cameras.filter(camera => camera.status === 'error').length
  const open = alerts.filter(alert => alert.status === 'open')
  const critical = open.filter(alert => alert.severity === 'critical').length
  const openCount = metrics?.openAlerts ?? open.length
  const outside = count?.outside ?? 0

  return <section className={[styles.section, className].filter(Boolean).join(' ')} aria-labelledby="live-metrics-title">
    <div className={styles.heading}>
      <h2 id="live-metrics-title" className={styles.title}>Ahora en la finca</h2>
      {first && <span className={styles.session}>▲▼ frente al inicio de la sesión</span>}
    </div>
    <ul className={styles.grid}>
      <MetricCard index={staggerFrom} icon={ShieldCheck} tone="safe" label="Ganado dentro de su zona"
        delta={count && first && <DeltaChip value={count.inside - first.inside} goodWhen="up" />}
        caption={count ? `${count.total} contadas por las cámaras` : 'Ninguna cámara ha contado todavía'}>
        {count ? <>
          <AnimatedNumber value={count.inside} />
          <span className={styles.total}>/{count.total}</span>
          {insidePercent !== null && <AnimatedNumber className={styles.percent} value={insidePercent} format={value => `${Math.round(value)} %`} />}
        </> : unknown}
      </MetricCard>
      <MetricCard index={staggerFrom + 1} icon={ShieldAlert} tone={outside > 0 ? 'alarm' : 'safe'} pulse={outside > 0 && !reduceMotion}
        label="Fuera de zona"
        delta={count && first && <DeltaChip value={outside - first.outside} goodWhen="down" />}
        caption={outside > 0 ? 'Revisa el lote marcado en rojo' : count ? 'Todo el hato dentro' : 'Sin conteo'}>
        {count ? <AnimatedNumber value={outside} /> : unknown}
      </MetricCard>
      <MetricCard index={staggerFrom + 2} icon={Cctv} tone={failing > 0 || (cameras.length > 0 && online === 0) ? 'person' : 'info'}
        label="Cámaras en línea"
        caption={cameras.length === 0 ? 'El servicio de IA no reporta cámaras'
          : failing > 0 ? `${failing} con error` : online < cameras.length ? `${cameras.length - online} sin conexión` : 'Todas transmitiendo'}>
        <AnimatedNumber value={online} />
        <span className={styles.total}>/{cameras.length}</span>
      </MetricCard>
      <MetricCard index={staggerFrom + 3} icon={BellRing} tone={critical > 0 ? 'alarm' : openCount > 0 ? 'person' : 'safe'}
        pulse={critical > 0 && !reduceMotion} label="Alertas abiertas"
        caption={<>
          {critical > 0 ? `${critical} críticas · ` : ''}
          {metrics ? `${metrics.eventsLastHour} eventos en la última hora` : 'Sin datos de eventos'}
        </>}>
        <AnimatedNumber value={openCount} />
      </MetricCard>
    </ul>
  </section>
}
