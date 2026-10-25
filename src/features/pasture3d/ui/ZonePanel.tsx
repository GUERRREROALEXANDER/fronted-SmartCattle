import { StatusPill } from '../../../components/ui'
import type { ZoneSummary } from '../simulation/herdSimulation'
import styles from './ZonePanel.module.css'

export interface ZonePanelProps {
  zones: readonly ZoneSummary[]
  activePresetId: string
  onSelect: (lotId: string) => void
}

export function ZonePanel({ zones, activePresetId, onSelect }: ZonePanelProps) {
  return (
    <section className={styles.panel} aria-labelledby="pasture-zones-title">
      <h2 id="pasture-zones-title" className={styles.title}>Zonas seguras</h2>
      <ul className={styles.list}>
        {zones.map(zone => (
          <li key={zone.lotId}>
            <button
              type="button"
              className={`${styles.zone} ${zone.breached ? styles.breached : ''}`}
              aria-pressed={activePresetId === zone.lotId}
              onClick={() => onSelect(zone.lotId)}
            >
              <span className={styles.name}>{zone.lotName}</span>
              <span className={`${styles.count} tabular`}>
                {zone.inside}/{zone.total}
                <span className={styles.countLabel}> dentro</span>
              </span>
              <span className={styles.status}>
                <StatusPill
                  tone={zone.breached ? 'critical' : 'safe'}
                  label={zone.breached
                    ? `Fuera de zona${zone.outside > 1 ? ` (${zone.outside})` : ''}`
                    : 'Dentro'}
                />
              </span>
            </button>
          </li>
        ))}
      </ul>
      <p className={styles.hint}>Elige una zona para acercar la cámara.</p>
    </section>
  )
}
