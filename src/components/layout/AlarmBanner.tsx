import { BellOff, Siren } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { alarm, useAlarmState } from '../../lib/alarm'
import { duration, ease } from '../../motion'
import styles from './AlarmBanner.module.css'

export function AlarmBanner() {
  const { active, lastReason } = useAlarmState()
  const reduce = useReducedMotion()
  const hasActive = active.length > 0

  return <AnimatePresence initial={false}>
    {hasActive && <motion.section key="alarm-banner" className={styles.banner}
      role="alert" aria-atomic="true"
      initial={{ opacity: 0, y: reduce ? 0 : -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: reduce ? 0 : -12 }}
      transition={{ duration: reduce ? duration.micro : duration.panel, ease: ease.out }}>
      <Siren className={styles.icon} size={24} strokeWidth={1.75} aria-hidden="true" />
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
