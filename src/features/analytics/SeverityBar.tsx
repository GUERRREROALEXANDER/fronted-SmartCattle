import type { SeverityShare } from './analyticsModel'
import { severityColors } from './chartTheme'
import { formatPercentage } from './percent'
import styles from './SeverityBar.module.css'

export function SeverityBar({ data }: { data: readonly SeverityShare[] }) {
  return <div className={styles.root} aria-hidden="true">
    <div className={styles.track}>
      {data.filter(row => row.count > 0).map(row => <div
        key={row.severity}
        className={`${styles.segment} ${styles[row.severity]}`}
        style={{ width: `${row.percentage}%`, backgroundColor: severityColors[row.severity] }}>
        {row.percentage >= 16 && formatPercentage(row.percentage)}
      </div>)}
    </div>
    <ul className={styles.legend}>
      {data.map(row => <li key={row.severity}>
        <span className={styles.swatch} style={{ backgroundColor: severityColors[row.severity] }} />
        <span>{row.label}</span>
        <strong>{formatPercentage(row.percentage)}</strong>
        <small>{row.count} {row.count === 1 ? 'evento' : 'eventos'}</small>
      </li>)}
    </ul>
  </div>
}
