import { useEffect, useId, useRef } from 'react'
import { TriangleAlert } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Link } from 'react-router'
import type { Camera, Severity } from '../../types/domain'
import styles from './CameraSwitcher.module.css'

interface CameraSwitcherProps {
  cameras: readonly Camera[]
  selectedId: string | null
  alertByCamera: ReadonlyMap<string, Severity>
  /** Cameras that deliver a picture; others are labeled "sin video" when online. */
  withVideo?: ReadonlySet<string>
}

const statusLabel: Record<Camera['status'], string> = {
  online: 'En línea', connecting: 'Conectando', offline: 'Sin conexión', error: 'Con error',
}

const indicatorSpring = { type: 'spring', stiffness: 380, damping: 30 } as const

/** Focus one camera while keeping the others in view. A list on desktop, a scrollable strip on phones. */
export function CameraSwitcher({ cameras, selectedId, alertByCamera, withVideo }: CameraSwitcherProps) {
  const listRef = useRef<HTMLUListElement>(null)
  const reduce = useReducedMotion()
  // The page renders a phone and a desktop switcher; each needs its own sliding indicator.
  const indicatorId = `camera-indicator-${useId()}`
  // On the horizontal phone strip, bring the selected camera into view without scrolling the page.
  useEffect(() => {
    const list = listRef.current
    const selected = list?.querySelector<HTMLElement>('[aria-current="true"]')?.parentElement
    if (!list || !selected || list.scrollWidth <= list.clientWidth) return
    list.scrollLeft = selected.offsetLeft - list.offsetLeft - 16
  }, [selectedId, cameras.length])

  return <nav className={styles.switcher} aria-label="Cámaras">
    <ul className={styles.list} ref={listRef}>
      {cameras.map(camera => {
        const severity = alertByCamera.get(camera.id)
        const selected = camera.id === selectedId
        return <li key={camera.id}>
          <Link className={`${styles.item} ${selected ? styles.selected : ''}`}
            to={`?camera=${encodeURIComponent(camera.id)}`} replace aria-current={selected ? 'true' : undefined}>
            {selected && <motion.span className={styles.indicator} layoutId={indicatorId} aria-hidden="true"
              transition={reduce ? { duration: 0 } : indicatorSpring} />}
            <span className={`${styles.dot} ${styles[camera.status]}`} aria-hidden="true" />
            <span className={styles.text}>
              <span className={styles.name}>{camera.name}</span>
              <span className={styles.meta}>{camera.location} · {statusLabel[camera.status]}{camera.status === 'online' && withVideo && !withVideo.has(camera.id) ? ' · sin video' : ''}</span>
            </span>
            {severity && <TriangleAlert className={`${styles.alert} ${styles[severity]}`} size={16} strokeWidth={2}
              role="img" aria-label="Con alerta reciente" />}
          </Link>
        </li>
      })}
    </ul>
  </nav>
}
