import { useRef, type KeyboardEvent } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import type { AnalyticsRange } from './analyticsModel'
import styles from './RangeTabs.module.css'

const options: readonly { value: AnalyticsRange, label: string }[] = [
  { value: '24h', label: '24 h' },
  { value: '7d', label: '7 días' },
  { value: '30d', label: '30 días' },
]

export function RangeTabs({ value, onChange }: {
  value: AnalyticsRange
  onChange: (range: AnalyticsRange) => void
}) {
  const tabs = useRef<Array<HTMLButtonElement | null>>([])
  const reduce = useReducedMotion()

  const selectFromKeyboard = (event: KeyboardEvent<HTMLButtonElement>, index: number) => {
    let next: number | null = null
    if (event.key === 'ArrowRight' || event.key === 'ArrowDown') next = (index + 1) % options.length
    if (event.key === 'ArrowLeft' || event.key === 'ArrowUp') next = (index - 1 + options.length) % options.length
    if (event.key === 'Home') next = 0
    if (event.key === 'End') next = options.length - 1
    if (next === null) return
    event.preventDefault()
    onChange(options[next].value)
    tabs.current[next]?.focus()
  }

  return <div className={styles.tabs} role="tablist" aria-label="Periodo del análisis">
    {options.map((option, index) => {
      const selected = option.value === value
      return <button
        key={option.value}
        ref={node => { tabs.current[index] = node }}
        id={`analytics-tab-${option.value}`}
        className={styles.tab}
        type="button"
        role="tab"
        aria-selected={selected}
        aria-controls="analytics-panel"
        tabIndex={selected ? 0 : -1}
        onClick={() => onChange(option.value)}
        onKeyDown={event => selectFromKeyboard(event, index)}>
        {selected && <motion.span
          className={styles.indicator}
          layoutId="analytics-range-selection"
          transition={reduce ? { duration: 0 } : { type: 'spring', stiffness: 380, damping: 30 }}
          aria-hidden="true" />}
        <span className={styles.label}>{option.label}</span>
      </button>
    })}
  </div>
}
