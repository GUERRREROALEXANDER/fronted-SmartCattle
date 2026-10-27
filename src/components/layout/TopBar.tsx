import { Bell, BellOff } from 'lucide-react'
import { alarm, useAlarmState } from '../../lib/alarm'
import { PulseRing } from '../../motion'
import { DataSourceBadge } from '../ui/DataSourceBadge'
import styles from './TopBar.module.css'

export function TopBar() {
  const { active, muted } = useAlarmState()
  const hasActive = active.length > 0
  const label = muted ? 'Activar sonido de alarma' : 'Silenciar alarma'
  const Icon = muted ? BellOff : Bell

  return <header className={styles.bar}>
    <span className={styles.wordmark}>SmartCattle</span>
    <div className={styles.actions}>
      <DataSourceBadge />
      <PulseRing active={hasActive} className={styles.alarmRing}>
        <button type="button" className={[styles.alarm, hasActive && styles.alarmActive].filter(Boolean).join(' ')}
          aria-label={label} aria-pressed={muted} title={label} onClick={() => alarm.setMuted(!muted)}>
          <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </PulseRing>
    </div>
  </header>
}
