import { useEffect, useRef, useState } from 'react'
import { animate, useInView, useReducedMotion } from 'motion/react'
import { duration, ease } from './presets'

const defaultFormat = (value: number) => Math.round(value).toLocaleString('es-CO')

/** Counts a number up the first time it scrolls into view. */
export function CountUp({ value, format = defaultFormat, className }: {
  value: number
  format?: (value: number) => string
  className?: string
}) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const reduce = useReducedMotion()
  const [shown, setShown] = useState(0)

  useEffect(() => {
    if (!inView || reduce) return
    const controls = animate(0, value, { duration: duration.reveal, ease: ease.out, onUpdate: setShown })
    return () => controls.stop()
  }, [inView, reduce, value])

  return <span ref={ref} className={className}>{format(reduce ? value : shown)}</span>
}
