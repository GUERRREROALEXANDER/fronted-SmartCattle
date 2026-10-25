import type { CameraShare } from './analyticsModel'
import { formatPercentage } from './percent'
import styles from './CameraBars.module.css'

export function CameraBars({ data }: { data: readonly CameraShare[] }) {
  const maximum = Math.max(1, ...data.map(row => row.count))
  return <ul className={styles.list} aria-hidden="true">
    {data.map(row => <li key={row.cameraId} className={styles.row}>
      <div className={styles.meta}>
        <span className={styles.name}>{row.name}</span>
        <strong className={styles.value}>{row.count} · {formatPercentage(row.percentage)}</strong>
      </div>
      <div className={styles.track}>
        <span className={styles.fill} style={{ width: `${row.count * 100 / maximum}%` }} />
      </div>
    </li>)}
  </ul>
}
