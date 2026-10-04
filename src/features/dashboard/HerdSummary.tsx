import { Skeleton } from '../../components/ui'
import { formatCount } from '../../lib/format'
import type { ResourceState } from '../../lib/useResource'
import styles from './HerdSummary.module.css'

interface HerdSummaryProps {
  title?: string
  registered: ResourceState<number>
  detected: ResourceState<number | null>
}

/** Registered and currently detected cattle are different facts and are never merged into one number. */
export function HerdSummary({ title = 'Ganado', registered, detected }: HerdSummaryProps) {
  return <section className={styles.section} aria-labelledby="herd-title">
    <h2 id="herd-title" className={styles.title}>{title}</h2>
    <dl className={styles.figures}>
      <Figure label="Registrados" state={registered} emptyText="Sin registros" />
      <Figure label="Detectados ahora" state={detected} emptyText="Sin datos de detección" />
    </dl>
    <p className={styles.note}>
      La detección puede variar por oclusión, ángulo de cámara o cambios de luz.
      Una diferencia no indica por sí sola que falte un animal.
    </p>
  </section>
}

function Figure({ label, state, emptyText }: { label: string; state: ResourceState<number | null>; emptyText: string }) {
  let value
  if (state.status === 'loading') value = <Skeleton width="3ch" height="1em" />
  else if (state.data === null || state.data === undefined) value = <span className={styles.empty}>{state.status === 'error' ? 'No disponible' : emptyText}</span>
  else value = <span className="tabular">{formatCount(state.data)}</span>
  const isEmpty = state.status !== 'loading' && (state.data === null || state.data === undefined)
  return <div className={styles.figure}>
    <dt className={styles.label}>{label}</dt>
    <dd className={`${styles.value} ${isEmpty ? styles.valueEmpty : ''}`}>{value}</dd>
  </div>
}
