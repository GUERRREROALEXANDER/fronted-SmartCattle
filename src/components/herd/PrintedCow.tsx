import sheet from '../../assets/herd/cow-sheet.png'
import type { Posture } from '../../types/domain'
import styles from './PrintedCow.module.css'

/** One animal printed in the current text color, cut from the approved 3D cow (see scripts/render-herd-sprites.mjs). */
export function PrintedCow({ posture, className }: { posture: Posture | null; className?: string }) {
  const pose = posture === 'walking' ? styles.walking : posture === 'lying' ? styles.lying : styles.standing
  return <span className={[styles.cow, pose, className].filter(Boolean).join(' ')} aria-hidden="true">
    <span className={styles.sheet} style={{ maskImage: `url(${sheet})`, WebkitMaskImage: `url(${sheet})` }} />
  </span>
}
