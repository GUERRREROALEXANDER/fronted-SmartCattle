import { OctagonAlert } from 'lucide-react'
import styles from './CowLabel.module.css'

export interface CowLabelProps {
  cowName: string
  lotName: string
  /** 'alert' marks a cow outside its lot; 'name' is the optional quiet tag. */
  variant: 'alert' | 'name'
}

/** Floating tag content for a cow; the label pool places it above the animal. */
export function CowLabel({ cowName, lotName, variant }: CowLabelProps) {
  return variant === 'alert' ? (
    <span className={`${styles.label} ${styles.alert}`}>
      <OctagonAlert size={16} strokeWidth={2} aria-hidden="true" />
      {cowName} fuera de {lotName}
    </span>
  ) : (
    <span className={`${styles.label} ${styles.name}`}>{cowName}</span>
  )
}
