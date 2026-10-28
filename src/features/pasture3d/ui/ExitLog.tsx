import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { LogIn, LogOut } from 'lucide-react'
import { duration, ease } from '../../../motion'
import { eventSentence, type HerdLogEntry } from '../simulation/useHerdSimulation'
import styles from './ExitLog.module.css'

const timeFormat = new Intl.DateTimeFormat('es-CO', {
  hour: '2-digit',
  minute: '2-digit',
  second: '2-digit',
})

export interface ExitLogProps {
  entries: readonly HerdLogEntry[]
}

export function ExitLog({ entries }: ExitLogProps) {
  const reduce = useReducedMotion()

  return (
    <section className={styles.panel} aria-labelledby="pasture-log-title">
      <h2 id="pasture-log-title" className={styles.title}>Salidas y regresos</h2>
      {entries.length === 0 ? (
        <p className={styles.empty}>Sin salidas en esta sesión.</p>
      ) : (
        <ol className={styles.list}>
          <AnimatePresence initial={false}>
            {entries.map(entry => {
              const Icon = entry.type === 'exit' ? LogOut : LogIn
              return (
                <motion.li
                  key={entry.id}
                  layout={!reduce}
                  className={`${styles.entry} ${entry.type === 'exit' ? styles.exit : styles.return}`}
                  initial={{ opacity: 0, x: reduce ? 0 : 16 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: reduce ? duration.micro : duration.state, ease: ease.out }}
                >
                  <span className={styles.icon} aria-hidden="true"><Icon size={16} strokeWidth={1.75} /></span>
                  <span className={styles.text}>
                    <span className={styles.kind}>{entry.type === 'exit' ? 'Salida' : 'Regreso'}</span>
                    {eventSentence(entry)}
                  </span>
                  <time className={`${styles.time} tabular`} dateTime={entry.time.toISOString()}>
                    {timeFormat.format(entry.time)}
                  </time>
                </motion.li>
              )
            })}
          </AnimatePresence>
        </ol>
      )}
    </section>
  )
}
