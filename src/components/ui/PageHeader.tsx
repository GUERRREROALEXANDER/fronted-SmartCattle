import { useRef, type ReactNode } from 'react'
import { motion, useReducedMotion, useScroll, useTransform } from 'motion/react'
import { HerdStrip } from '../herd/HerdStrip'
import styles from './PageHeader.module.css'

/** The page's printed band: its ink edge to edge, its name in wood type, the herd walking along the bottom. */
export function PageHeader({ title, description, actions }: { title: string; description?: ReactNode; actions?: ReactNode }) {
  const reduce = useReducedMotion()
  const band = useRef<HTMLElement>(null)
  const { scrollYProgress } = useScroll({ target: band, offset: ['start start', 'end start'] })
  // Depth: the type falls behind the band as it leaves, slower than the page.
  const titleTransform = useTransform(scrollYProgress, [0, 1], ['translateY(0%) scale(1)', 'translateY(34%) scale(0.92)'])
  return <header ref={band} className={styles.band}>
    <div className={styles.top}>
      <motion.h1 className={styles.title} style={reduce ? undefined : { transform: titleTransform }}>{title}</motion.h1>
      {actions && <div className={styles.actions}>{actions}</div>}
    </div>
    {description && <p className={styles.description}>{description}</p>}
    <HerdStrip className={styles.herd} />
  </header>
}
