import { OctagonAlert } from 'lucide-react'
import type { Posture } from '../../../types/domain'
import styles from './CowLabel.module.css'

export interface CowLabelProps {
  cowName: string
  lotName: string
  /** 'alert' marks a cow outside its lot; 'name' is the optional quiet tag. */
  variant: 'alert' | 'name'
  /** What the AI estimates it is doing. */
  posture?: Posture | null
}

const POSTURE_TEXT: Record<Posture, string> = { standing: 'Parada', walking: 'Caminando', lying: 'Acostada' }

/** Floating tag content for a cow; the label pool places it above the animal. */
export function CowLabel({ cowName, lotName, variant, posture }: CowLabelProps) {
  const doing = posture ? ` · ${POSTURE_TEXT[posture]}` : ''
  return variant === 'alert' ? (
    <span className={`${styles.label} ${styles.alert}`}>
      <OctagonAlert size={16} strokeWidth={2} aria-hidden="true" />
      {cowName} fuera de {lotName}{doing}
    </span>
  ) : (
    <span className={`${styles.label} ${styles.name}`}>{cowName}{doing}</span>
  )
}
