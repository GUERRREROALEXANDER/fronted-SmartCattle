import { useEffect } from 'react'
import { motion, useReducedMotion, useSpring, useTransform } from 'motion/react'

const defaultFormat = (value: number) => Math.round(value).toLocaleString('es-CO')

export interface AnimatedNumberProps {
  value: number
  format?: (value: number) => string
  className?: string
}

export function AnimatedNumber({ value, format = defaultFormat, className }: AnimatedNumberProps) {
  const reduce = useReducedMotion()
  const spring = useSpring(value, { stiffness: 180, damping: 24 })
  const display = useTransform(spring, latest => format(latest))

  useEffect(() => {
    if (reduce) spring.jump(value)
    else spring.set(value)
  }, [reduce, spring, value])

  return <motion.span className={className}>{display}</motion.span>
}
