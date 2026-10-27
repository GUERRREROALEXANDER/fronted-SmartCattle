import { Activity, BellRing, ShieldCheck, UserRound, type LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { AnimatedNumber, DeltaChip } from '../../motion'
import { liveSessionDeltas, type LiveHerdSnapshot } from './liveHerd'
import styles from './LiveMetrics.module.css'

function MetricCard({ icon: Icon, tone, label, delta, deltaLabel, children, caption }: {
  icon: LucideIcon
  tone: 'safe' | 'alarm' | 'info' | 'person'
  label: string
  delta: ReactNode
  deltaLabel: string
  children: ReactNode
  caption: ReactNode
}) {
  return <li className={`${styles.card} ${styles[tone]}`}>
    <div className={styles.cardTop}>
      <span className={styles.icon}><Icon size={20} strokeWidth={2} aria-hidden="true" /></span>
      <span className={styles.delta} title={deltaLabel}>{delta}</span>
    </div>
    <p className={styles.label}>{label}</p>
    <p className={styles.value}>{children}</p>
    <p className={styles.caption}>{caption}</p>
  </li>
}

export function LiveMetrics({ snapshot, baseline }: { snapshot: LiveHerdSnapshot; baseline: LiveHerdSnapshot }) {
  const deltas = liveSessionDeltas(snapshot, baseline)
  const outside = snapshot.totalCount - snapshot.insideCount
  const percentFormat = (value: number) => `${Math.round(value)} %`

  return <section className={styles.section} aria-labelledby="live-metrics-title">
    <div className={styles.heading}>
      <h2 id="live-metrics-title" className={styles.title}>Métricas en tiempo real</h2>
      <span className={styles.session}>▲▼ frente al inicio de la sesión</span>
    </div>
    <ul className={styles.grid}>
      <MetricCard icon={ShieldCheck} tone={outside > 0 ? 'alarm' : 'safe'} label="Ganado dentro del perímetro"
        deltaLabel="Cambio en puntos porcentuales"
        delta={<DeltaChip value={deltas.insidePercentage} goodWhen="up" format={value => `${value} p. p.`} />}
        caption={outside > 0 ? `${outside} fuera del perímetro` : 'Todo el hato dentro'}>
        <AnimatedNumber value={snapshot.insideCount} />
        <span className={styles.total}>/{snapshot.totalCount}</span>
        <AnimatedNumber className={styles.percent} value={snapshot.insidePercentage} format={percentFormat} />
      </MetricCard>
      <MetricCard icon={BellRing} tone={snapshot.alertCount > 0 ? 'alarm' : 'safe'} label="Alertas emitidas"
        deltaLabel="Alertas nuevas en esta sesión"
        delta={<DeltaChip value={deltas.alertCount} goodWhen="down" />}
        caption="Salidas del perímetro en la sesión">
        <AnimatedNumber value={snapshot.alertCount} />
      </MetricCard>
      <MetricCard icon={Activity} tone="info" label="Detecciones por minuto"
        deltaLabel="Cambio en detecciones por minuto"
        delta={<DeltaChip value={deltas.detectionsPerMinute} goodWhen="up" />}
        caption="Ventana móvil de 10 segundos">
        <AnimatedNumber value={snapshot.detectionsPerMinute} />
      </MetricCard>
      <MetricCard icon={UserRound} tone="person" label="Personas detectadas"
        deltaLabel="Cambio en personas detectadas"
        delta={<DeltaChip value={deltas.peopleCount} goodWhen="down" />}
        caption="Recorriendo el camino junto al lindero">
        <AnimatedNumber value={snapshot.peopleCount} />
      </MetricCard>
    </ul>
  </section>
}
