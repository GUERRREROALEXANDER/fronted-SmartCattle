import { useRef, useState } from 'react'
import { Ellipsis } from 'lucide-react'
import { NavLink, useLocation } from 'react-router'
import { navItems, profileItem } from '../../app/navigation'
import { MoreSheet } from './MoreSheet'
import styles from './MobileTabBar.module.css'

export function MobileTabBar() {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const { pathname } = useLocation()
  const moreActive = [...navItems.filter(item => !item.primaryOnMobile), profileItem]
    .some(item => pathname === item.path || pathname.startsWith(`${item.path}/`))

  return <>
    <nav aria-label="Principal" className={styles.bar}>
      {navItems.filter(item => item.primaryOnMobile).map(({ id, path, label, icon: Icon }) =>
        <NavLink key={id} to={path} end={path === '/'} className={styles.cell}>
          <Icon size={20} strokeWidth={1.75} aria-hidden="true" /><span>{label}</span>
        </NavLink>)}
      <button ref={triggerRef} type="button" className={`${styles.cell} ${moreActive ? styles.active : ''}`}
        aria-haspopup="dialog" aria-expanded={open} aria-controls="more-sheet" onClick={() => setOpen(true)}>
        <Ellipsis size={20} strokeWidth={1.75} aria-hidden="true" /><span>Más</span>
      </button>
    </nav>
    <MoreSheet open={open} onClose={() => { setOpen(false); triggerRef.current?.focus() }} />
  </>
}
