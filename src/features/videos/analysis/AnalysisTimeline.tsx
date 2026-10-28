import type { AnalysisAlert } from '../detection/types'
import { alertMarkers, formatClock } from './analysisModel'
import styles from './AnalysisTimeline.module.css'

export interface AnalysisTimelineProps {
  currentSec: number
  durationSec: number
  alerts: AnalysisAlert[]
  onSeek: (timeSec: number) => void
}

export function AnalysisTimeline({ currentSec, durationSec, alerts, onSeek }: AnalysisTimelineProps) {
  const known = Number.isFinite(durationSec) && durationSec > 0
  const progress = known ? Math.min(100, (currentSec / durationSec) * 100) : 0
  const markers = alertMarkers(alerts, durationSec)

  return (
    <div className={styles.timeline}>
      <div className={styles.track}>
        <div className={styles.rail} aria-hidden="true">
          <div className={styles.fill} style={{ width: `${progress}%` }} />
        </div>
        <input
          type="range"
          className={styles.range}
          min={0}
          max={known ? durationSec : 0}
          step={0.1}
          value={known ? Math.min(currentSec, durationSec) : 0}
          disabled={!known}
          onChange={event => onSeek(Number(event.target.value))}
          aria-label="Posición del video"
          aria-valuetext={`${formatClock(currentSec)} de ${formatClock(durationSec)}`}
        />
      </div>
      <div className={styles.markers} aria-label={markers.length > 0 ? `Momentos con alertas: ${markers.length}` : undefined}>
        {markers.map(({ alert, percent }) => (
          <button
            key={`${alert.track_id}-${alert.time_sec}`}
            type="button"
            className={`${styles.marker} ${alert.cls === 'cattle' ? styles.cattle : styles.person}`}
            style={{ left: `${percent}%` }}
            onClick={() => onSeek(alert.time_sec)}
            aria-label={`Alerta: ${alert.cls === 'cattle' ? 'vaca' : 'persona'} #${alert.track_id} fuera del perímetro en ${formatClock(alert.time_sec)}. Ir a ese momento`}
            title={`${alert.cls === 'cattle' ? 'Vaca' : 'Persona'} #${alert.track_id} · ${formatClock(alert.time_sec)}`}
          >
            <span className={styles.pin} aria-hidden="true" />
          </button>
        ))}
        {markers.length === 0 && <span className={styles.hint}>Las alertas aparecerán marcadas aquí</span>}
      </div>
    </div>
  )
}
