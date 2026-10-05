import { Skeleton } from '../../components/ui'
import { formatCount, formatTime } from '../../lib/format'
import type { ResourceState } from '../../lib/useResource'
import type { HerdCount } from '../../services/animalService'
import styles from './HerdSummary.module.css'

interface HerdSummaryProps {
  title?: string
  registered: ResourceState<number>
  detected: ResourceState<HerdCount | null>
  /** The server is offline: the detected count is the last one received, not a live number. */
  stale?: boolean
}

/**
 * The herd line: registered and detected cattle side by side in one sentence, never merged into
 * one number, with where the detected count comes from and when it was taken.
 */
export function HerdSummary({ title = 'Ganado', registered, detected, stale = false }: HerdSummaryProps) {
  const loading = registered.status === 'loading' || detected.status === 'loading'
  const count = detected.data ?? null
  return <section className={styles.section} aria-labelledby="herd-title">
    <h2 id="herd-title" className={styles.title}>{title}</h2>
    {loading
      ? <Skeleton width="18ch" height="1.6em" />
      : <p className={styles.line}>
        <span className={styles.part}>{registered.data === null || registered.data === undefined
          ? <span className={styles.empty}>Registros no disponibles</span>
          : registered.data === 0 ? <span className={styles.empty}>No hay animales registrados</span>
          : <><strong className="tabular">{formatCount(registered.data)}</strong> registrados</>}</span>
        {registered.data != null && registered.data !== 0 && count !== null && <span className={styles.separator} aria-hidden="true">·</span>}
        <span className={`${styles.part} ${stale ? styles.stale : ''}`}>{count === null
          ? <span className={styles.empty}>Sin datos de detección</span>
          : <><strong className="tabular">{formatCount(count.count)}</strong> {stale ? 'detectados en el último dato' : 'detectados ahora'}{detected.source === 'mock' && ' (simulado)'}</>}</span>
      </p>}
    {count && <p className={styles.source}>
      {detected.source === 'mock'
        ? <>Conteo simulado de demostración: el servicio de visión aún no está conectado · <time className="tabular" dateTime={count.countedAt.toISOString()}>{formatTime(count.countedAt)}</time></>
        : stale
        ? <>Último conteo recibido a las <time className="tabular" dateTime={count.countedAt.toISOString()}>{formatTime(count.countedAt)}</time>, antes de perder la conexión.</>
        : <>Conteo de toda la finca del servicio de visión · <time className="tabular" dateTime={count.countedAt.toISOString()}>{formatTime(count.countedAt)}</time></>}
    </p>}
    <p className={styles.note}>
      La detección puede variar por oclusión, ángulo de cámara o cambios de luz: una diferencia no indica por sí sola que falte un animal.
      Cada cámara ve solo una parte de la finca, así que este total no es la suma de lo que muestran las imágenes.
    </p>
  </section>
}
