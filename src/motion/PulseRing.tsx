import type { ReactNode } from 'react'
import styles from './PulseRing.module.css'

export interface PulseRingProps {
  active?: boolean
  tone?: 'alarm' | 'brand'
  className?: string
  children: ReactNode
}

export function PulseRing({ active = true, tone = 'alarm', className, children }: PulseRingProps) {
  return <span className={[styles.ring, styles[tone], className].filter(Boolean).join(' ')}>
    {children}
    {active && <span className={styles.pulse} aria-hidden="true" />}
  </span>
}
