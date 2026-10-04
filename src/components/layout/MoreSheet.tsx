import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { NavLink } from 'react-router'
import { navItems, profileItem } from '../../app/navigation'
import styles from './MoreSheet.module.css'

export function MoreSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const pointerStartedOutside = useRef(false)

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

  function isOutside(clientX: number, clientY: number) {
    const bounds = dialogRef.current!.getBoundingClientRect()
    return clientX < bounds.left || clientX > bounds.right || clientY < bounds.top || clientY > bounds.bottom
  }

  return <dialog ref={dialogRef} id="more-sheet" aria-labelledby="more-sheet-title" className={styles.sheet}
    onClose={onClose}
    onPointerDown={event => { pointerStartedOutside.current = isOutside(event.clientX, event.clientY) }}
    onClick={event => {
      if (pointerStartedOutside.current && isOutside(event.clientX, event.clientY)) dialogRef.current?.close()
      pointerStartedOutside.current = false
    }}>
    <header className={styles.header}>
      <h2 id="more-sheet-title">Más opciones</h2>
      <button type="button" className={styles.close} aria-label="Cerrar" onClick={() => dialogRef.current?.close()}>
        <X size={20} strokeWidth={1.75} aria-hidden="true" />
      </button>
    </header>
    <nav aria-label="Más opciones" className={styles.links}>
      {[...navItems.filter(item => !item.primaryOnMobile), profileItem].map(({ id, path, label, icon: Icon }) =>
        <NavLink key={id} to={path} className={styles.item} onClick={() => dialogRef.current?.close()}>
          <Icon size={20} strokeWidth={1.75} aria-hidden="true" /><span>{label}</span>
        </NavLink>)}
    </nav>
  </dialog>
}
