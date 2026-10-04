import { useId, type ReactNode, type HTMLAttributes, type Ref } from 'react'
import { CircleCheck, TriangleAlert, OctagonAlert, Info } from 'lucide-react'
import styles from './Notice.module.css'

export interface NoticeProps extends Omit<HTMLAttributes<HTMLDivElement>, 'title'> {
  ref?: Ref<HTMLDivElement>
  tone: 'info' | 'warning' | 'critical' | 'safe'
  title: string
  children?: ReactNode
  action?: ReactNode
}
const icons = { safe: CircleCheck, warning: TriangleAlert, critical: OctagonAlert, info: Info }
export function Notice({ tone, title, children, action, className, ...props }: NoticeProps) {
  const titleId = useId()
  const Icon = icons[tone]
  return <div {...props} role={tone === 'critical' ? 'alert' : 'status'} aria-labelledby={titleId}
    className={[styles.notice, styles[tone], className].filter(Boolean).join(' ')}>
    <Icon className={styles.icon} size={20} strokeWidth={1.75} aria-hidden="true" />
    <div className={styles.content}>
      <p id={titleId} className={styles.title}>{title}</p>
      {children && <div className={styles.description}>{children}</div>}
    </div>
    {action && <div className={styles.action}>{action}</div>}
  </div>
}
