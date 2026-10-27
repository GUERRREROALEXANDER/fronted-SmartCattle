import styles from './DeltaChip.module.css'

const defaultFormat = (value: number) => value.toLocaleString('es-CO', { maximumFractionDigits: 1 })

export interface DeltaChipProps {
  value: number
  goodWhen?: 'up' | 'down'
  format?: (value: number) => string
  className?: string
}

export function DeltaChip({ value, goodWhen = 'up', format = defaultFormat, className }: DeltaChipProps) {
  const direction = value > 0 ? 'up' : value < 0 ? 'down' : 'flat'
  const tone = direction === 'flat' ? 'neutral' : direction === goodWhen ? 'good' : 'bad'
  const arrow = direction === 'flat' ? '—' : direction === 'up' ? '▲' : '▼'
  const formatted = format(Math.abs(value))
  const label = direction === 'flat' ? 'Sin cambios' : `${direction === 'up' ? 'Aumento' : 'Disminución'}: ${formatted}`

  return <span className={[styles.chip, styles[tone], className].filter(Boolean).join(' ')} aria-label={label}>
    <span className={styles.arrow} aria-hidden="true">{arrow}</span>
    <span aria-hidden="true">{formatted}</span>
  </span>
}
