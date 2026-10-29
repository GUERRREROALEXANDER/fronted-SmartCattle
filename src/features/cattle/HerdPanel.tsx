import { AlertTriangle, CircleHelp, EyeOff } from 'lucide-react'
import type { Animal } from '../../types/domain'
import { EmptyState, StatusPill } from '../../components/ui'
import { countHerd, hoursSinceSeen, needsAttention, STALE_AFTER_HOURS } from './herdModel'
import styles from './HerdPanel.module.css'

const statusLabel = { active: 'Activo', inactive: 'Inactivo', lost: 'Perdido' } as const

/** Which pill tone, so a lost animal does not look like a healthy one. */
const statusTone = { active: 'safe', inactive: 'inactive', lost: 'critical' } as const

function sinceLabel(animal: Animal, now: Date): string {
  const hours = hoursSinceSeen(animal, now)
  // Not "hace 0 h" and not a dash: an animal that has never been detected is
  // a different situation from one seen recently, and the row should say which.
  if (hours === null) return 'Nunca detectado'
  if (hours < 1) return 'Hace menos de 1 h'
  if (hours < 48) return `Hace ${Math.round(hours)} h`
  return `Hace ${Math.round(hours / 24)} días`
}

export interface HerdPanelProps {
  animals: readonly Animal[]
  now: Date
}

/**
 * The registered herd, led by the animals that need looking at.
 *
 * Not a full table: the page already shows what the cameras see. What was
 * missing is the registry -- which animals exist and which of them nobody can
 * account for.
 */
export function HerdPanel({ animals, now }: HerdPanelProps) {
  const counts = countHerd(animals, now)
  const attention = needsAttention(animals, now)

  if (counts.total === 0) {
    return <EmptyState
      icon={CircleHelp}
      title="No hay animales registrados"
      description="Registra el hato para poder saber cuáles faltan. Sin registro, el sistema solo puede contar los animales que la cámara ve en este momento."
    />
  }

  return <div className={styles.panel}>
    <dl className={styles.counts}>
      <div><dt>Registrados</dt><dd className="tabular">{counts.total}</dd></div>
      <div><dt>Activos</dt><dd className="tabular">{counts.active}</dd></div>
      {counts.lost > 0 && <div className={styles.alarming}>
        <dt>Perdidos</dt><dd className="tabular">{counts.lost}</dd>
      </div>}
      {counts.inactive > 0 && <div><dt>Inactivos</dt><dd className="tabular">{counts.inactive}</dd></div>}
    </dl>

    {/*
      Said in words, because the two numbers answer different questions and a
      bare count next to "sin ver" would not say which.
    */}
    {(counts.neverSeen > 0 || counts.stale > 0) && <p className={styles.summary}>
      {counts.neverSeen > 0 && <span>
        <EyeOff size={14} strokeWidth={2} aria-hidden="true" />
        {counts.neverSeen === 1
          ? '1 animal registrado que nunca se ha detectado'
          : `${counts.neverSeen} animales registrados que nunca se han detectado`}
      </span>}
      {counts.stale > 0 && <span>
        <AlertTriangle size={14} strokeWidth={2} aria-hidden="true" />
        {counts.stale === 1
          ? `1 animal sin ver desde hace más de ${STALE_AFTER_HOURS} h`
          : `${counts.stale} animales sin ver desde hace más de ${STALE_AFTER_HOURS} h`}
      </span>}
    </p>}

    {attention.length === 0
      ? <p className={styles.allWell}>Todos los animales activos se han visto en las últimas {STALE_AFTER_HOURS} horas.</p>
      : <table className={styles.table}>
        <caption className="visually-hidden">
          Animales que necesitan atención, del más preocupante al menos
        </caption>
        <thead>
          <tr><th scope="col">Arete</th><th scope="col">Nombre</th><th scope="col">Estado</th><th scope="col">Visto</th></tr>
        </thead>
        <tbody>
          {attention.map(animal => <tr key={animal.tag}>
            <td className="tabular">{animal.tag}</td>
            {/* An em dash, not an empty cell: the name is optional, and a
                blank cell reads as data that failed to load. */}
            <td>{animal.name ?? '—'}</td>
            <td><StatusPill tone={statusTone[animal.status]} label={statusLabel[animal.status]} /></td>
            <td>{sinceLabel(animal, now)}</td>
          </tr>)}
        </tbody>
      </table>}
  </div>
}
