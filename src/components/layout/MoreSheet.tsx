import { useEffect, useRef, useState } from 'react'
import { X } from 'lucide-react'
import { NavLink } from 'react-router'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { navItems, profileItem } from '../../app/navigation'
import { duration, ease } from '../../motion'
import styles from './MoreSheet.module.css'

const spring = { type: 'spring', stiffness: 380, damping: 34 } as const

function ActiveMarker() {
  const reduce = useReducedMotion()
  if (reduce) return <span className={styles.marker} aria-hidden="true" />
  return <motion.span className={styles.marker} layoutId="more-sheet-active" transition={spring} aria-hidden="true" />
}

export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const reduce = useReducedMotion()
  const [closing, setClosing] = useState(false)
  const [wasOpen, setWasOpen] = useState(open)
  if (wasOpen !== open) {
    setWasOpen(open)
    if (!open) setClosing(false)
  }
  // The native dialog stays open until the exit animation ends, then closes (and fires onClose).
  const visible = open && !closing
  const requestClose = () => setClosing(true)

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (open && !dialog.open) dialog.showModal()
    if (!open && dialog.open) dialog.close()
  }, [open])

  useEffect(() => {
    const desktop = window.matchMedia('(min-width: 1024px)')
    const closeOnDesktop = () => { if (desktop.matches) dialogRef.current?.close() }
    desktop.addEventListener('change', closeOnDesktop)
    return () => desktop.removeEventListener('change', closeOnDesktop)
  }, [])

  return <dialog ref={dialogRef} id="more-sheet" aria-labelledby="more-sheet-title" className={styles.sheet}
    onClose={onClose}
    onCancel={event => { event.preventDefault(); requestClose() }}>
    <AnimatePresence onExitComplete={() => { if (closing) dialogRef.current?.close() }}>
      {visible && <motion.div key="scrim" className={styles.scrim} onClick={requestClose} aria-hidden="true"
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
        transition={{ duration: duration.state, ease: ease.out }} />}
      {visible && <motion.div key="panel" className={styles.panel}
        initial={{ y: reduce ? 0 : '100%', opacity: reduce ? 0 : 1 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: reduce ? 0 : '100%', opacity: reduce ? 0 : 1 }}
        transition={reduce ? { duration: duration.micro } : spring}>
        <span className={styles.grabber} aria-hidden="true" />
        <header className={styles.header}>
          <h2 id="more-sheet-title">Más opciones</h2>
          <button type="button" className={styles.close} aria-label="Cerrar" onClick={requestClose}>
            <X size={20} strokeWidth={1.75} aria-hidden="true" />
          </button>
        </header>
        <nav aria-label="Más opciones" className={styles.links}>
          {[...navItems.filter(item => !item.primaryOnMobile), profileItem].map(({ id, path, label, icon: Icon }) =>
            <NavLink key={id} to={path} className={styles.item} onClick={requestClose}>
              {({ isActive }) => <>
                {isActive && <ActiveMarker />}
                <span className={styles.icon}><Icon size={20} strokeWidth={1.75} aria-hidden="true" /></span>
                <span>{label}</span>
              </>}
            </NavLink>)}
        </nav>
      </motion.div>}
    </AnimatePresence>
  </dialog>
}
