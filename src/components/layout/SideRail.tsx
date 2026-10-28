import { NavLink } from 'react-router'
import { motion, useReducedMotion } from 'motion/react'
import { navItems, profileItem } from '../../app/navigation'
import { BrandMark } from '../ui/BrandMark'
import { DataSourceBadge } from '../ui/DataSourceBadge'
import styles from './SideRail.module.css'
import { useAuth } from '../../app/auth/useAuth'

const pillSpring = { type: 'spring', stiffness: 380, damping: 30 } as const

function ActiveMarker() {
  const reduce = useReducedMotion()
  if (reduce) return <span className={styles.marker} aria-hidden="true" />
  return <motion.span className={styles.marker} layoutId="rail-active" transition={pillSpring} aria-hidden="true" />
}

export function SideRail() {
  const { session } = useAuth()
  const user = session?.user
  const initials = user?.name.trim().split(/\s+/).map(part => part[0]).slice(0, 2).join('').toUpperCase()
  return <header className={styles.rail}>
    <div className={styles.wordmark}><BrandMark /></div>
    <nav aria-label="Principal" className={styles.navigation}>
      <p className={styles.section} aria-hidden="true">Menú</p>
      {navItems.map(({ id, path, label, icon: Icon }) =>
        <NavLink key={id} to={path} end={path === '/'} className={styles.item}>
          {({ isActive }) => <>
            {isActive && <ActiveMarker />}
            <span className={styles.icon}><Icon size={19} strokeWidth={1.75} aria-hidden="true" /></span>
            <span className={styles.label}>{label}</span>
          </>}
        </NavLink>)}
    </nav>
    <div className={styles.bottom}>
      <div className={styles.badge}><DataSourceBadge tone="on-brand" /></div>
      <NavLink to={profileItem.path} className={`${styles.item} ${styles.user}`}>
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
