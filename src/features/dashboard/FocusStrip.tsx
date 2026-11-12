import { Link } from 'react-router'
import { useAuth } from '../../app/auth/useAuth'
import { countPostures, herdNow } from '../../live/herdNow'
import { entityKind } from '../../live/herdTracker'
import { useLive } from '../../live/useLive'
import { GOALS, onboardingOf, type Goal } from '../onboarding/onboardingModel'
import styles from './FocusStrip.module.css'

const LINKS: Record<Goal, string> = { zone: '/pasture', people: '/live', lying: '/pasture', report: '/informe' }

/** What this person told Lucero they care about, answered first, with the cameras' numbers of right now. */
export function FocusStrip() {
  const { session } = useAuth()
  const { frames, updatedAt } = useLive()
  const goals = session ? onboardingOf(session.user.id)?.goals ?? [] : []
  if (goals.length === 0) return null
  const animals = herdNow(frames)
  const outside = animals.filter(animal => animal.outside).length
  const people = Object.values(frames).flatMap(frame => frame.detections).filter(detection => entityKind(detection.label) === 'person').length
  const postures = countPostures(animals)
  const known = updatedAt !== null
  const value: Record<Goal, string> = {
    zone: !known ? '—' : outside === 0 ? 'Ninguna fuera' : `${outside} fuera`,
    people: !known ? '—' : people === 0 ? 'Nadie a la vista' : `${people} a la vista`,
    // With no posture reported, "0 echadas" would state something the AI never said.
    lying: !known ? '—' : animals.length === 0 ? 'Sin ganado a la vista'
      : postures.unknown === animals.length ? `${animals.length} a la vista, sin postura`
      : `${postures.lying} echadas · ${postures.standing} de pie · ${postures.walking} caminando`,
    report: 'Ver el informe',
  }
  return <ul className={styles.strip} aria-label="Lo que elegiste vigilar">
    {goals.map(goal => <li key={goal}>
      <Link to={LINKS[goal]} className={styles.item}>
        <span className={styles.name}>{GOALS.find(item => item.id === goal)?.title}</span>
        <span className={styles.value}>{value[goal]}</span>
      </Link>
    </li>)}
  </ul>
}
