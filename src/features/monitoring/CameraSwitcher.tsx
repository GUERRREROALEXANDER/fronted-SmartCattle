import { useEffect, useRef } from 'react'
import { TriangleAlert } from 'lucide-react'
import { Link } from 'react-router'
import type { Camera, Severity } from '../../types/domain'
import styles from './CameraSwitcher.module.css'

interface CameraSwitcherProps {
  cameras: readonly Camera[]
  selectedId: string | null
  alertByCamera: ReadonlyMap<string, Severity>
}

const statusLabel: Record<Camera['status'], string> = {
  online: 'En línea', connecting: 'Conectando', offline: 'Sin conexión', error: 'Con error',
}

/** Focus one camera while keeping the others in view. A list on desktop, a scrollable strip on phones. */
export function CameraSwitcher({ cameras, selectedId, alertByCamera }: CameraSwitcherProps) {
  const listRef = useRef<HTMLUListElement>(null)
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
            <span className={`${styles.dot} ${styles[camera.status]}`} aria-hidden="true" />
            <span className={styles.text}>
              <span className={styles.name}>{camera.name}</span>
              <span className={styles.meta}>{camera.location} · {statusLabel[camera.status]}</span>
            </span>
            {severity && <TriangleAlert className={`${styles.alert} ${styles[severity]}`} size={16} strokeWidth={2}
              role="img" aria-label="Con alerta reciente" />}
          </Link>
        </li>
      })}
    </ul>
  </nav>
}
