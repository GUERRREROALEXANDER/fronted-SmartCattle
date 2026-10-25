import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { duration, ease, staggerDelay } from './presets'

/** One item of a list that staggers in on first render (capped, see presets). */
export function StaggerItem({ index = 0, className, children }: { index?: number; className?: string; children: ReactNode }) {
  const reduce = useReducedMotion()
  return <motion.div className={className}
    initial={{ opacity: 0, y: reduce ? 0 : 8 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: reduce ? duration.micro : duration.state, ease: ease.out, delay: reduce ? 0 : staggerDelay(index) }}>
    {children}
  </motion.div>
}
