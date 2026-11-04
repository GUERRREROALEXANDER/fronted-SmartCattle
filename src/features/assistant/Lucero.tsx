import styles from './Lucero.module.css'

export type LuceroMood = 'idle' | 'thinking' | 'speaking'

// The lucero is the white star on a cow's forehead: eight long points around a center.
const STAR = Array.from({ length: 16 }, (_, index) => {
  const radius = index % 2 === 0 ? 50 : 20
  const angle = (index * Math.PI) / 8 - Math.PI / 2
  return `${(50 + radius * Math.cos(angle)).toFixed(2)},${(50 + radius * Math.sin(angle)).toFixed(2)}`
}).join(' ')

/** The assistant's face: a printed star that breathes, spins while it looks something up and pulses as it answers. */
export function Lucero({ mood = 'idle', size = 48, className }: { mood?: LuceroMood; size?: number; className?: string }) {
  return <svg className={[styles.star, styles[mood], className].filter(Boolean).join(' ')} width={size} height={size} viewBox="0 0 100 100" aria-hidden="true">
    <polygon className={styles.back} points={STAR} transform="rotate(22.5 50 50)" />
    <polygon className={styles.front} points={STAR} />
    <circle className={styles.eye} cx="50" cy="50" r="8" />
  </svg>
}
