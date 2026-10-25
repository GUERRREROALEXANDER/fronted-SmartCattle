import type { ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { duration, ease } from './presets'

/** Fades a block up once on mount; reduced motion gets a plain, short fade. */
export function FadeUp({ delay = 0, className, children }: { delay?: number; className?: string; children: ReactNode }) {
  const reduce = useReducedMotion()
  return <motion.div className={className}
    initial={{ opacity: 0, y: reduce ? 0 : 16 }}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: reduce ? duration.micro : duration.panel, ease: ease.out, delay: reduce ? 0 : delay }}>
    {children}
  </motion.div>
}
