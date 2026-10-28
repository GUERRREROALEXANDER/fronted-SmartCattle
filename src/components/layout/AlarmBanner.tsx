import { BellOff, Siren } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { alarm, useAlarmState } from '../../lib/alarm'
import { duration, ease, PulseRing } from '../../motion'
import styles from './AlarmBanner.module.css'

export function AlarmBanner() {
  const { active, lastReason } = useAlarmState()
  const reduce = useReducedMotion()
  const hasActive = active.length > 0

  return <AnimatePresence initial={false}>
    {hasActive && <motion.section key="alarm-banner" className={styles.banner}
      role="alert" aria-atomic="true"
      initial={{ opacity: 0, y: reduce ? 0 : -24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduce ? 0 : -16, transition: { duration: duration.state, ease: ease.in } }}
      transition={reduce ? { duration: duration.micro } : { type: 'spring', stiffness: 420, damping: 28 }}>
      <span className={styles.accent} aria-hidden="true" />
      <PulseRing className={styles.iconRing}>
        <span className={styles.icon}><Siren size={22} strokeWidth={2} aria-hidden="true" /></span>
      </PulseRing>
      <div className={styles.copy}>
        <p className={styles.reason}>{lastReason ?? 'Alarma de seguridad activa.'}</p>
        <p className={styles.sources}>{active.length} {active.length === 1 ? 'fuente activa' : 'fuentes activas'}</p>
      </div>
      <button type="button" className={styles.mute} onClick={() => alarm.setMuted(true)}>
        <BellOff size={18} strokeWidth={1.75} aria-hidden="true" />
        Silenciar
      </button>
    </motion.section>}
  </AnimatePresence>
}
