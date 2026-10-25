import { Html } from '@react-three/drei'
import { OctagonAlert } from 'lucide-react'
import styles from './CowLabel.module.css'

export interface CowLabelProps {
  cowName: string
  lotName: string
  /** 'alert' marks a cow outside its lot; 'name' is the optional quiet tag. */
  variant: 'alert' | 'name'
}

// Keeps labels under the app rail, tab bar and banners.
const Z_INDEX_RANGE = [10, 0]

export function CowLabel({ cowName, lotName, variant }: CowLabelProps) {
  return (
    <Html
      position={[0, variant === 'alert' ? 3 : 2.6, 0]}
      center
      zIndexRange={Z_INDEX_RANGE}
      pointerEvents="none"
    >
      {variant === 'alert' ? (
        <span className={`${styles.label} ${styles.alert}`}>
          <OctagonAlert size={16} strokeWidth={2} aria-hidden="true" />
          {cowName} fuera de {lotName}
        </span>
      ) : (
        <span className={`${styles.label} ${styles.name}`}>{cowName}</span>
      )}
    </Html>
  )
}
