import { useRef, useState } from 'react'
import { Ellipsis } from 'lucide-react'
import { NavLink, useLocation } from 'react-router'
import { motion, useReducedMotion } from 'motion/react'
import { navItems, profileItem, type NavigationItem } from '../../app/navigation'
import { MoreSheet } from './MoreSheet'
import styles from './MobileTabBar.module.css'

function ActiveMarker() {
  const reduce = useReducedMotion()
  if (reduce) return <span className={styles.marker} aria-hidden="true" />
  return <motion.span className={styles.marker} layoutId="tabbar-active"
    transition={{ type: 'spring', stiffness: 380, damping: 30 }} aria-hidden="true" />
}

export function MobileTabBar() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { pathname } = useLocation()
  const moreActive = [...navItems.filter(item => !item.primaryOnMobile), profileItem]
    .some(item => pathname === item.path || pathname.startsWith(`${item.path}/`))

  return <>
    <nav aria-label="Principal" className={styles.bar}>
      {navItems.filter(item => item.primaryOnMobile).map((item: NavigationItem) => { const { id, path, label, shortLabel, icon: Icon } = item; return (
        <NavLink key={id} to={path} end={path === '/'} className={styles.cell} aria-label={label}>
          {({ isActive }) => <>
            {isActive && <ActiveMarker />}
            <Icon size={20} strokeWidth={1.75} aria-hidden="true" /><span>{shortLabel ?? label}</span>
          </>}
        </NavLink>) })}
      <button ref={triggerRef} type="button" className={`${styles.cell} ${moreActive ? styles.active : ''}`}
        aria-haspopup="dialog" aria-expanded={open} aria-controls="more-sheet" onClick={() => setOpen(true)}>
        {moreActive && <ActiveMarker />}
        <Ellipsis size={20} strokeWidth={1.75} aria-hidden="true" /><span>Más</span>
      </button>
    </nav>
    <MoreSheet open={open} onClose={() => { setOpen(false); triggerRef.current?.focus() }} />
  </>
}
