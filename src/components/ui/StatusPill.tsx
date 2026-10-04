import { CircleCheck, TriangleAlert, OctagonAlert, CircleDashed, Info } from 'lucide-react'
import styles from './StatusPill.module.css'

export interface StatusPillProps {
  tone: 'safe' | 'warning' | 'critical' | 'inactive' | 'info'
  label: string
  size?: 'sm' | 'md'
}
const icons = { safe: CircleCheck, warning: TriangleAlert, critical: OctagonAlert, inactive: CircleDashed, info: Info }
export function StatusPill({ tone, label, size = 'sm' }: StatusPillProps) {
  const Icon = icons[tone]
  return <span className={`${styles.pill} ${styles[tone]} ${styles[size]}`}>
    <Icon size={size === 'sm' ? 14 : 16} strokeWidth={1.75} aria-hidden="true" />{label}
  </span>
}
