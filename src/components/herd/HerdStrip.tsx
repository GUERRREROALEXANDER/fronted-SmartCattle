import { useMemo, type CSSProperties } from 'react'
import { countPostures, herdNow } from '../../live/herdNow'
import { useLive } from '../../live/useLive'
import { PrintedCow } from './PrintedCow'
import styles from './HerdStrip.module.css'

const MAX_PRINTED = 24

/** Who the cameras see right now, printed: one figure per animal, in the posture the AI reports. Empty when nothing is seen. */
export function HerdStrip({ className }: { className?: string }) {
  const { frames } = useLive()
  const animals = useMemo(() => herdNow(frames), [frames])
  const counts = countPostures(animals)
  if (animals.length === 0) return null
  const parts = [
    counts.walking > 0 && `${counts.walking} caminando`,
    counts.standing > 0 && `${counts.standing} de pie`,
    counts.lying > 0 && `${counts.lying} ${counts.lying === 1 ? 'echada' : 'echadas'}`,
    counts.unknown > 0 && `${counts.unknown} sin postura`,
  ].filter(Boolean).join(', ')
  // Each animal gets its own stretch of the band, in a stable order, so a big herd reads as figures and not as a mass.
  const printed = [...animals].sort((a, b) => a.place - b.place).slice(0, MAX_PRINTED)
  return <div className={[styles.strip, className].filter(Boolean).join(' ')} role="img" aria-label={`Ganado a la vista: ${parts}`}
    style={{ '--herd-size': printed.length } as CSSProperties}>
    {printed.map(animal => <span key={animal.id} className={styles.place} data-walking={animal.posture === 'walking' || undefined}>
      <PrintedCow posture={animal.posture} />
    </span>)}
  </div>
}
