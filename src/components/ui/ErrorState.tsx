import { CloudOff, RotateCw } from 'lucide-react'
import { Button } from './Button'
import { EmptyState, type EmptyStateProps } from './EmptyState'
import styles from './ErrorState.module.css'

export interface ErrorStateProps extends Omit<EmptyStateProps, 'title'> {
  title?: string
  onRetry?: () => void
}
export function ErrorState({ title = 'No se pudo cargar la información', description, icon = CloudOff, action, onRetry }: ErrorStateProps) {
  return <div role="alert" className={styles.error}>
    <EmptyState title={title} description={description} icon={icon}
      action={action || onRetry ? <>{action}{onRetry && <Button variant="secondary" icon={RotateCw} onClick={onRetry}>Reintentar</Button>}</> : undefined} />
  </div>
}
