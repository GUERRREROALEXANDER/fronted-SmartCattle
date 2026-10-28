import { Activity, Cpu, Timer, TriangleAlert, UserRound } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { AnimatedNumber, DeltaChip, duration, ease, PulseRing } from '../../../motion'
import type { AnalysisAlert } from '../detection/types'
import { formatClock, MODEL_LABEL } from './analysisModel'
import type { AnalysisPhase, HudStats } from './useVideoAnalysis'
import styles from './AnalysisHud.module.css'

const PHASE_LABEL: Record<AnalysisPhase, string> = {
  idle: 'Sin iniciar',
  running: 'Analizando',
  paused: 'En pausa',
  done: 'Terminado',
}

const RECENT_ALERT_SEC = 5

const oneDecimal = (value: number) => value.toLocaleString('es-CO', { minimumFractionDigits: 1, maximumFractionDigits: 1 })

export interface AnalysisHudProps {
  phase: AnalysisPhase
  hud: HudStats
  alerts: AnalysisAlert[]
  onSeek: (timeSec: number) => void
  /** Small screens start with the performance details collapsed. */
  compact?: boolean
}

export function AnalysisHud({ phase, hud, alerts, onSeek, compact = false }: AnalysisHudProps) {
  const { counts } = hud
  const reduce = useReducedMotion()
  const live = phase === 'running'
  const alarmActive = live && counts.cattleOutside > 0
  const recentAlerts = alerts.filter(alert => alert.time_sec >= hud.timeSec - RECENT_ALERT_SEC && alert.time_sec <= hud.timeSec).length
  const recent = alerts.slice(-4).reverse()

  return (
    <section className={styles.hud} aria-label="Panel de detección">
      <header className={styles.header}>
        <div>
          <p className={styles.eyebrow}>Modelo</p>
          <p className={styles.model}>{MODEL_LABEL}</p>
        </div>
        <span className={`${styles.phase} ${styles[phase]}`}>
          <span className={styles.phaseDot} aria-hidden="true" />
          {PHASE_LABEL[phase]}
        </span>
      </header>

      <dl className={styles.counters}>
        <div className={`${styles.counter} ${styles.cattle}`}>
          <dt>Vacas</dt>
          <dd><AnimatedNumber value={counts.cattle} /></dd>
        </div>
        <div className={`${styles.counter} ${styles.people}`}>
          <dt>Personas</dt>
          <dd><AnimatedNumber value={counts.people} /></dd>
        </div>
        <div className={`${styles.counter} ${counts.outside > 0 ? styles.danger : ''}`}>
          <dt>Fuera del perímetro</dt>
          <dd>
            <PulseRing active={alarmActive} className={styles.ring}>
              <AnimatedNumber value={counts.outside} className={styles.ringValue} />
            </PulseRing>
          </dd>
        </div>
        <div className={`${styles.counter} ${alerts.length > 0 ? styles.danger : ''}`}>
          <dt>Alertas</dt>
          <dd>
            <AnimatedNumber value={alerts.length} />
            {recentAlerts > 0 && <DeltaChip value={recentAlerts} goodWhen="down" className={styles.delta} />}
          </dd>
        </div>
      </dl>

      <details className={styles.tech} open={compact ? undefined : true}>
        <summary className={styles.techSummary}>Rendimiento</summary>
        <dl className={styles.techList}>
          <div><dt><Activity size={16} aria-hidden="true" />FPS de análisis</dt><dd>{live || hud.fps > 0 ? oneDecimal(hud.fps) : '—'}</dd></div>
          <div><dt><Cpu size={16} aria-hidden="true" />Inferencia</dt><dd>{hud.inferenceMs > 0 ? `${oneDecimal(hud.inferenceMs)} ms` : '—'}</dd></div>
          <div><dt><Timer size={16} aria-hidden="true" />Tiempo del cuadro</dt><dd>{formatClock(hud.timeSec)}</dd></div>
        </dl>
      </details>

      {counts.peopleInside > 0 && (
        <p className={styles.warning}>
          <UserRound size={16} aria-hidden="true" />
          {counts.peopleInside === 1 ? 'Hay una persona dentro del predio' : `Hay ${counts.peopleInside} personas dentro del predio`}
        </p>
      )}

      <div className={styles.alerts}>
        <p className={styles.eyebrow}>Últimas alertas</p>
        {recent.length === 0 ? (
          <p className={styles.empty}>Sin alertas por ahora.</p>
        ) : (
          <ul className={styles.alertList}>
            <AnimatePresence initial={false}>
              {recent.map(alert => (
                <motion.li
                  key={`${alert.track_id}-${alert.time_sec}`}
                  layout={!reduce}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, x: 16, scale: 0.96 }}
                  animate={{ opacity: 1, x: 0, scale: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: duration.state, ease: ease.out }}
                >
                <button type="button" className={styles.alertItem} onClick={() => onSeek(alert.time_sec)}
                  aria-label={`${alert.cls === 'cattle' ? 'Vaca' : 'Persona'} #${alert.track_id} salió del perímetro en ${formatClock(alert.time_sec)}. Ir a ese momento`}>
                  <TriangleAlert size={16} aria-hidden="true" className={alert.cls === 'cattle' ? styles.iconCritical : styles.iconWarning} />
                  <span>{alert.cls === 'cattle' ? 'Vaca' : 'Persona'} #{alert.track_id} fuera</span>
                  <span className={styles.time}>{formatClock(alert.time_sec)}</span>
                </button>
              </motion.li>
            ))}
            </AnimatePresence>
          </ul>
        )}
      </div>
    </section>
  )
}
