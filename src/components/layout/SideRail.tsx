import { NavLink } from 'react-router'
import { motion, useReducedMotion } from 'motion/react'
import { navItems, profileItem } from '../../app/navigation'
import { DataSourceBadge } from '../ui/DataSourceBadge'
import { duration, ease } from '../../motion'
import styles from './SideRail.module.css'
import { useAuth } from '../../app/auth/useAuth'

function ActiveMarker() {
  const reduce = useReducedMotion()
  if (reduce) return <span className={styles.marker} aria-hidden="true" />
  return <motion.span className={styles.marker} layoutId="rail-active"
    transition={{ duration: duration.state, ease: ease.out }} aria-hidden="true" />
}

export function SideRail() {
  const { session } = useAuth()
  const user = session?.user
  const initials = user?.name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()
  return <header className={styles.rail}>
    <span className={styles.wordmark}>SmartCattle</span>
    <nav aria-label="Principal" className={styles.navigation}>
      {navItems.map(({ id, path, label, icon: Icon }) =>
        <NavLink key={id} to={path} end={path === '/'} className={styles.item}>
          {({ isActive }) => <>
            {isActive && <ActiveMarker />}
            <Icon size={20} strokeWidth={1.75} aria-hidden="true" />{label}
          </>}
        </NavLink>)}
    </nav>
    <div className={styles.bottom}>
      <DataSourceBadge tone="on-brand" />
      <NavLink to={profileItem.path} className={styles.item}>
        {({ isActive }) => <>
          {isActive && <ActiveMarker />}
          <span className={styles.avatar} aria-hidden="true">{initials}</span>
          <span className={styles.identity}>
            <span className={styles.name}>{user?.name}</span>
            <span className={styles.role}>{user?.role === 'owner' ? 'Dueño' : 'Trabajador'}</span>
          </span>
        </>}
      </NavLink>
    </div>
  </header>
}
