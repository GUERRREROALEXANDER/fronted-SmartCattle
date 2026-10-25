import { motion, useReducedMotion } from 'motion/react'
import { duration, ease } from './presets'

/** Each word rises out of its own clipped line box. Reduced motion renders the text at once. */
export function MaskedText({ text, className, delay = 0 }: { text: string; className?: string; delay?: number }) {
  const reduce = useReducedMotion()
  if (reduce) return <span className={className}>{text}</span>
  const words = text.split(' ')
  return <span className={className} aria-label={text}>
    {words.map((word, index) =>
      <span key={`${word}-${index}`} aria-hidden="true"
        style={{ display: 'inline-block', overflow: 'hidden', paddingBottom: '0.08em', verticalAlign: 'bottom' }}>
        <motion.span style={{ display: 'inline-block' }}
          initial={{ y: '110%' }} animate={{ y: 0 }}
          transition={{ duration: duration.reveal, ease: ease.out, delay: delay + index * 0.06 }}>
          {word}{index < words.length - 1 ? ' ' : ''}
        </motion.span>
      </span>)}
  </span>
}
