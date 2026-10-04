import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'
import styles from './EmptyState.module.css'

export interface EmptyStateProps {
  title: string
  description?: string
  action?: ReactNode
  icon?: LucideIcon
}
export function EmptyState({ title, description, action, icon: Icon }: EmptyStateProps) {
  return <div className={styles.state}>
    {Icon && <Icon className={styles.icon} size={28} strokeWidth={1.75} aria-hidden="true" />}
    <h2 className={styles.title}>{title}</h2>
    {description && <p className={styles.description}>{description}</p>}
    {action && <div className={styles.action}>{action}</div>}
  </div>
}
