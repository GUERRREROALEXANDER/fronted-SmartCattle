import type { HTMLAttributes, ReactNode, Ref } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { duration, ease } from '../../motion/presets'
import styles from './GlassCard.module.css'

const elements = {
  div: motion.div,
  section: motion.section,
  article: motion.article,
  aside: motion.aside,
  header: motion.header,
  li: motion.li,
}

type MotionConflicts = 'onDrag' | 'onDragStart' | 'onDragEnd' | 'onAnimationStart' | 'onAnimationEnd' | 'onAnimationIteration'

export interface GlassCardProps extends Omit<HTMLAttributes<HTMLElement>, MotionConflicts> {
  ref?: Ref<HTMLElement>
  as?: keyof typeof elements
  /** Adds hover lift and press feedback; use only on clickable cards. */
  interactive?: boolean
  padding?: 'none' | 'sm' | 'md' | 'lg'
  tone?: 'default' | 'strong' | 'subtle' | 'brand'
  /** Plays the fade + rise entrance on mount (default true). */
  enter?: boolean
  /** Entrance delay in seconds. */
  delay?: number
  children?: ReactNode
}

export function GlassCard({ as = 'div', interactive = false, padding = 'md', tone = 'default', enter = true,
  delay = 0, className, children, ref, ...props }: GlassCardProps) {
  const reduce = useReducedMotion()
  const Element = elements[as] as typeof motion.div
  const spring = { type: 'spring' as const, stiffness: 380, damping: 30 }
  return <Element {...props} ref={ref as Ref<HTMLDivElement>}
    className={[styles.card, styles[tone], styles[`pad-${padding}`], interactive && styles.interactive, className]
      .filter(Boolean).join(' ')}
    initial={enter ? { opacity: 0, y: reduce ? 0 : 12 } : false}
    animate={{ opacity: 1, y: 0 }}
    transition={{ duration: reduce ? duration.micro : 0.45, ease: ease.out, delay: reduce ? 0 : delay }}
    whileHover={interactive && !reduce ? { y: -2, transition: spring } : undefined}
    whileTap={interactive && !reduce ? { scale: 0.98, transition: spring } : undefined}>
    {children}
  </Element>
}
