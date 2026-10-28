import { CalendarClock, Cctv, OctagonAlert, ListChecks, ShieldAlert, type LucideIcon } from 'lucide-react'
import { GlassCard } from '../../components/ui'
import { AnimatedNumber, DeltaChip, staggerDelay } from '../../motion'
import styles from './KpiTile.module.css'

type Tone = 'brand' | 'alarm' | 'info' | 'warning' | 'lilac'

const toneIcon: Record<Tone, LucideIcon> = {
  brand: ListChecks, alarm: ShieldAlert, warning: OctagonAlert, info: CalendarClock, lilac: Cctv,
}

export function KpiTile({ label, value, caption, format, delta, index = 0, tone = 'brand', icon }: {
  label: string
  value: number
  caption: string
  format?: (value: number) => string
  /** Change against the previous period; omitted when there is nothing to compare with. */
  delta?: { value: number; goodWhen: 'up' | 'down'; format?: (value: number) => string }
  index?: number
  tone?: Tone
  /** Badge icon; defaults to one per tone. */
  icon?: LucideIcon
}) {
  const Icon = icon ?? toneIcon[tone]
  return <GlassCard as="li" padding="none" delay={staggerDelay(index)} className={`${styles.tile} ${styles[tone]}`}>
    <div className={styles.top}>
      <span className={styles.badge} aria-hidden="true"><Icon size={18} strokeWidth={2} /></span>
      {delta && <DeltaChip value={delta.value} goodWhen={delta.goodWhen} format={delta.format} />}
    </div>
    <p className={styles.label}>{label}</p>
    <strong className={styles.value}><AnimatedNumber value={value} format={format} /></strong>
    <p className={styles.caption}>{caption}</p>
  </GlassCard>
}
