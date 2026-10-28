import { Children, isValidElement, type ReactNode } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { duration, ease, staggerDelay } from './presets'

const PAGE_ENTER = 0.45
const RISE = 12

const containers = { div: motion.div, ul: motion.ul, ol: motion.ol, section: motion.section }
const items = { div: motion.div, li: motion.li }

export interface RevealProps {
  delay?: number
  /** Animate when scrolled into view instead of on mount. */
  inView?: boolean
  className?: string
  children: ReactNode
}

/** Fade + 12px rise. Reduced motion gets a short opacity change only. */
export function Reveal({ delay = 0, inView = false, className, children }: RevealProps) {
  const reduce = useReducedMotion()
  const target = { opacity: 1, y: 0 }
  return <motion.div className={className}
    initial={{ opacity: 0, y: reduce ? 0 : RISE }}
    animate={inView ? undefined : target}
    whileInView={inView ? target : undefined}
    viewport={inView ? { once: true, amount: 0.2 } : undefined}
    transition={{ duration: reduce ? duration.micro : PAGE_ENTER, ease: ease.out, delay: reduce ? 0 : delay }}>
    {children}
  </motion.div>
}

export interface StaggerProps {
  as?: keyof typeof containers
  itemAs?: keyof typeof items
  className?: string
  itemClassName?: string
  /** Delay before the first child, in seconds. */
  delay?: number
  children: ReactNode
}

/**
 * Wraps each child and reveals them one after another. The step is capped by staggerDelay,
 * so long lists finish within ~0.4s.
 */
export function Stagger({ as = 'div', itemAs, className, itemClassName, delay = 0, children }: StaggerProps) {
  const reduce = useReducedMotion()
  const Container = containers[as] as typeof motion.div
  const Item = items[itemAs ?? (as === 'ul' || as === 'ol' ? 'li' : 'div')] as typeof motion.div
  let index = 0
  return <Container className={className}>
    {Children.map(children, child => {
      if (child === null || child === undefined || typeof child === 'boolean') return child
      const key = isValidElement(child) && child.key !== null ? child.key : index
      const position = index++
      return <Item key={key} className={itemClassName}
        initial={{ opacity: 0, y: reduce ? 0 : RISE }}
        animate={{ opacity: 1, y: 0 }}
        transition={{
          duration: reduce ? duration.micro : PAGE_ENTER,
          ease: ease.out,
          delay: reduce ? 0 : delay + staggerDelay(position),
        }}>
        {child}
      </Item>
    })}
  </Container>
}
