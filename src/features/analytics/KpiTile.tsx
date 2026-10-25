import { CountUp } from '../../motion'
import styles from './KpiTile.module.css'

export function KpiTile({ label, value, caption, format }: {
  label: string
  value: number
  caption: string
  format?: (value: number) => string
}) {
  return <li className={styles.tile}>
    <p className={styles.label}>{label}</p>
    <strong className={styles.value}><CountUp value={value} format={format} /></strong>
    <p className={styles.caption}>{caption}</p>
  </li>
}
