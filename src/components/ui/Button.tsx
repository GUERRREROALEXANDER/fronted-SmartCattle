import type { ButtonHTMLAttributes } from 'react'
import { Loader2, type LucideIcon } from 'lucide-react'
import styles from './Button.module.css'

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger'
  size?: 'md' | 'sm'
  fullWidth?: boolean
  loading?: boolean
  icon?: LucideIcon
}

export function Button({ variant = 'primary', size = 'md', fullWidth = false, loading = false, icon: Icon,
  type = 'button', disabled, className, children, ...props }: ButtonProps) {
  return <button {...props} type={type} disabled={disabled || loading}
    aria-busy={loading || props['aria-busy']}
    className={[styles.button, fullWidth && styles.fullWidth, styles[variant], size === 'sm' && styles.sm,
      loading && styles.loading, className].filter(Boolean).join(' ')}>
    <span className={styles.content}>
      {Icon && <Icon size={18} strokeWidth={1.75} aria-hidden="true" />}
      {children}
    </span>
    {loading && <Loader2 className={styles.spinner} size={18} strokeWidth={1.75} aria-hidden="true" />}
  </button>
}
