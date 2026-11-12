import { ScanEye } from 'lucide-react'
import styles from './BrandMark.module.css'

export interface BrandMarkProps {
  /** Hide the wordmark and keep only the glyph. */
  compact?: boolean
  tone?: 'default' | 'on-dark'
  size?: 'sm' | 'md' | 'lg'
  className?: string
}

export function BrandMark({ compact = false, tone = 'default', size = 'md', className }: BrandMarkProps) {
  return <span className={[styles.mark, styles[size], tone === 'on-dark' && styles.onDark, className].filter(Boolean).join(' ')}>
    <span className={styles.glyph} aria-hidden="true"><ScanEye strokeWidth={2} /></span>
    {compact ? <span className="visually-hidden">SmartCattle</span>
      : <span className={styles.word}>Smart<span className={styles.accent}>Cattle</span></span>}
  </span>
}
