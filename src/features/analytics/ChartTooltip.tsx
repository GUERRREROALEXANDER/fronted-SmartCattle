import type { TooltipContentProps } from 'recharts'
import styles from './ChartTooltip.module.css'

type Entry = TooltipContentProps<number | string, string>['payload'][number]

export interface ChartTooltipProps extends Partial<Pick<TooltipContentProps<number | string, string>, 'active' | 'payload' | 'label'>> {
  /** Formats each value; receives the series name so units can differ per series. */
  formatValue?: (value: number | string, name: string) => string
  /** Hides the heading when the series name already says everything (single-slice charts). */
  hideLabel?: boolean
}

function swatchColor(entry: Entry): string {
  const { stroke, fill, color, payload } = entry as Entry & { stroke?: string; fill?: string; payload?: { fill?: string } }
  const candidates = [stroke, color, fill, payload?.fill]
  return candidates.find(value => typeof value === 'string' && value !== 'none' && !value.startsWith('url(')) ?? 'var(--color-brand)'
}

/** Glass tooltip shared by every chart: frosted panel, colored swatch per series, tabular values. */
export function ChartTooltip({ active, payload, label, formatValue, hideLabel = false }: ChartTooltipProps) {
  if (!active || !payload?.length) return null
  return <div className={styles.tooltip}>
    {!hideLabel && label !== undefined && label !== '' && <p className={styles.label}>{label}</p>}
    <ul className={styles.list}>
      {payload.map((entry, index) => {
        const name = String(entry.name ?? entry.dataKey ?? '')
        const value = entry.value ?? ''
        return <li key={`${name}-${index}`} className={styles.row}>
          <span className={styles.swatch} style={{ background: swatchColor(entry) }} aria-hidden="true" />
          <span className={styles.name}>{name}</span>
          <strong className={styles.value}>{formatValue ? formatValue(value as number | string, name) : String(value)}</strong>
        </li>
      })}
    </ul>
  </div>
}
