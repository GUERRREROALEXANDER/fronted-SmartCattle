import { useEffect, useState } from 'react'
import { Bell, BellOff } from 'lucide-react'
import { Link } from 'react-router'
import { alarm, useAlarmState } from '../../lib/alarm'
import { PulseRing } from '../../motion'
import { BrandMark } from '../ui/BrandMark'
import { DataSourceBadge } from '../ui/DataSourceBadge'
import { profileItem } from '../../app/navigation'
import type { AuthUser } from '../../types/auth'
import styles from './TopBar.module.css'

export interface TopBarProps {
  /** Current page title; without it the bar shows the wordmark. */
  title?: string
  /** Signed-in user for the avatar link (rendered only inside the router). */
  user?: Pick<AuthUser, 'name'>
}

function useScrolled(threshold = 4) {
  const [scrolled, setScrolled] = useState(false)
  useEffect(() => {
    const update = () => setScrolled(window.scrollY > threshold)
    update()
    window.addEventListener('scroll', update, { passive: true })
    return () => window.removeEventListener('scroll', update)
  }, [threshold])
  return scrolled
}

export function TopBar({ title, user }: TopBarProps = {}) {
  const { active, muted } = useAlarmState()
  const scrolled = useScrolled()
  const hasActive = active.length > 0
  const label = muted ? 'Activar sonido de alarma' : 'Silenciar alarma'
  const Icon = muted ? BellOff : Bell
  const initials = user?.name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()

  return <header className={[styles.bar, scrolled && styles.scrolled].filter(Boolean).join(' ')}>
    <div className={styles.lead}>
      {title ? <>
        <BrandMark compact size="sm" />
        <p className={styles.title}>{title}</p>
      </> : <BrandMark size="sm" />}
    </div>
    <div className={styles.actions}>
      <DataSourceBadge />
      <PulseRing active={hasActive} className={styles.alarmRing}>
        <button type="button" className={[styles.alarm, hasActive && styles.alarmActive].filter(Boolean).join(' ')}
          aria-label={label} aria-pressed={muted} title={label} onClick={() => alarm.setMuted(!muted)}>
          <Icon size={20} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </PulseRing>
      {user && <Link to={profileItem.path} className={styles.avatar} aria-label={`Perfil de ${user.name}`}>
        <span aria-hidden="true">{initials}</span>
      </Link>}
    </div>
  </header>
}
