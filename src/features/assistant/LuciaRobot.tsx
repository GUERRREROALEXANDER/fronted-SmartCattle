import { useEffect, useState } from 'react'
import type { LuciaMood } from './luciaMood'
import styles from './LuciaRobot.module.css'

const GREETING_MS = 2800

/** Lucía herself. She is drawn, not photographed, so she stays sharp at any size and weighs nothing to load. */
export function LuciaRobot({ mood, className = '' }: { mood: LuciaMood; className?: string }) {
  const [greeting, setGreeting] = useState(true)
  useEffect(() => {
    const done = setTimeout(() => setGreeting(false), GREETING_MS)
    return () => clearTimeout(done)
  }, [])

  return <svg className={`${styles.robot} ${className}`} data-mood={mood === 'idle' && greeting ? 'greeting' : mood}
    viewBox="0 0 200 240" aria-hidden="true" focusable="false">
    <ellipse className={styles.shadow} cx="100" cy="229" rx="40" ry="7" />
    <g className={styles.figure}>
      <g className={styles.armLeft}>
        <path className={styles.metal} d="M70 122C50 130 37 160 35 184c-1 12 13 16 20 6 6-18 16-38 27-52z" />
      </g>
      <g className={styles.armRight}>
        <path className={styles.metal} d="M130 122c20 8 33 38 35 62 1 12-13 16-20 6-6-18-16-38-27-52z" />
      </g>
      <path className={styles.metal} d="M100 104c-28 0-44 26-44 52 0 34 22 56 44 56s44-22 44-56c0-26-16-52-44-52z" />
      <path className={styles.shade} d="M122 112c10 12 15 28 15 44 0 26-13 45-30 51 21-3 37-24 37-51 0-18-8-34-22-44z" />
      <path className={styles.seam} d="M60 170c9 3 17 5 25 6v7h30v-7c8-1 16-3 25-6" />

      <g className={styles.head}>
        <rect className={styles.metal} x="82" y="92" width="36" height="20" rx="8" />
        <rect className={styles.metal} x="33" y="50" width="18" height="38" rx="9" />
        <rect className={styles.metal} x="149" y="50" width="18" height="38" rx="9" />
        <rect className={styles.metal} x="44" y="28" width="112" height="76" rx="34" />
        <rect className={styles.visor} x="54" y="40" width="92" height="54" rx="24" />
        <path className={styles.glint} d="M64 58c2-7 7-10 13-11" />
        <g className={styles.eyes}>
          <path className={styles.light} d="M70 70a11.500 11.500 0 0 1 23 0c0 2-2 2-3 1a13 13 0 0 0-17 0c-1 1-3 1-3-1z" />
          <path className={styles.light} d="M107 70a11.500 11.500 0 0 1 23 0c0 2-2 2-3 1a13 13 0 0 0-17 0c-1 1-3 1-3-1z" />
        </g>
        <path className={`${styles.light} ${styles.mouth}`} d="M92 77h16a8 8 0 0 1-16 0z" />

        <g className={styles.hat}>
          <path className={styles.straw} d="M66 30C66 8 82 0 100 6c18-6 34 2 34 24z" />
          <path className={styles.band} d="M66 22c20 7 48 7 68 0v10c-20 6-48 6-68 0z" />
          <path className={styles.straw} d="M24 36c12-10 30-9 42-6 22 5 46 5 68 0 12-3 30-4 42 6-14 12-46 15-76 15s-62-3-76-15z" />
          <path className={styles.weave} d="M44 39c34 7 78 7 112 0M84 11c10 2 22 2 32 0" />
        </g>
      </g>
    </g>
  </svg>
}
