import { motion, useReducedMotion } from 'motion/react'
import { AnimatedNumber, DeltaChip, duration, ease, staggerDelay } from '../../motion'
import styles from './KpiTile.module.css'

export function KpiTile({ label, value, caption, format, delta, index = 0, tone = 'brand' }: {
  label: string
  value: number
  caption: string
  format?: (value: number) => string
  /** Change against the previous period; omitted when there is nothing to compare with. */
  delta?: { value: number; goodWhen: 'up' | 'down'; format?: (value: number) => string }
  index?: number
  tone?: 'brand' | 'alarm' | 'info' | 'warning' | 'lilac'
}) {
  const reduce = useReducedMotion()
  return <motion.li className={`${styles.tile} ${styles[tone]}`}
    initial={{ opacity: 0, y: reduce ? 0 : 10 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: reduce ? duration.micro : duration.panel, ease: ease.out, delay: reduce ? 0 : staggerDelay(index) }}>
    <p className={styles.label}>{label}</p>
    <strong className={styles.value}><AnimatedNumber value={value} format={format} /></strong>
    <div className={styles.footer}>
      {delta && <DeltaChip value={delta.value} goodWhen={delta.goodWhen} format={delta.format} />}
      <p className={styles.caption}>{caption}</p>
    </div>
  </motion.li>
}
