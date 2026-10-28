import { OctagonAlert, ShieldCheck } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { AnimatedNumber, PulseRing } from '../../../motion'
import type { ZoneSummary } from '../simulation/herdSimulation'
import styles from './ZonePanel.module.css'

export interface ZonePanelProps {
  zones: readonly ZoneSummary[]
  activePresetId: string
  onSelect: (lotId: string) => void
}

const hoverSpring = { type: 'spring', stiffness: 380, damping: 30 } as const

export function ZonePanel({ zones, activePresetId, onSelect }: ZonePanelProps) {
  const reduce = useReducedMotion()

  return (
    <section className={styles.panel} aria-labelledby="pasture-zones-title">
      <div className={styles.head}>
        <h2 id="pasture-zones-title" className={styles.title}>Zonas seguras</h2>
        <p className={styles.hint}>Elige una zona para acercar la cámara.</p>
      </div>
      <ul className={styles.list}>
        {zones.map(zone => {
          const label = zone.breached ? `Fuera de zona${zone.outside > 1 ? ` (${zone.outside})` : ''}` : 'Dentro'
          return (
            <li key={zone.lotId}>
              <motion.button
                type="button"
                className={`${styles.zone} ${zone.breached ? styles.breached : ''}`}
                aria-pressed={activePresetId === zone.lotId}
                onClick={() => onSelect(zone.lotId)}
                whileHover={reduce ? undefined : { y: -2 }}
                whileTap={reduce ? undefined : { scale: 0.98 }}
                transition={hoverSpring}
              >
                <PulseRing active={zone.breached} className={styles.badgeRing}>
                  <span className={styles.badge} aria-hidden="true">
                    {zone.breached
                      ? <OctagonAlert size={18} strokeWidth={2} />
                      : <ShieldCheck size={18} strokeWidth={1.75} />}
                  </span>
                </PulseRing>
                <span className={styles.name}>{zone.lotName}</span>
                <span className={`${styles.count} tabular`}>
                  <AnimatedNumber value={zone.inside} />/{zone.total}
                  <span className={styles.countLabel}> dentro</span>
                </span>
                <span className={styles.status}>{label}</span>
              </motion.button>
            </li>
          )
        })}
      </ul>
    </section>
  )
}
