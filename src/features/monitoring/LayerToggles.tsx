import { Eye, EyeOff } from 'lucide-react'
import type { OverlayLayers } from './DetectionOverlay'
import styles from './LayerToggles.module.css'

const options: { key: keyof OverlayLayers; label: string }[] = [
  { key: 'boxes', label: 'Detecciones' },
  { key: 'zones', label: 'Zona segura' },
  { key: 'labels', label: 'Etiquetas' },
]

/** Client-side display toggles for the overlay layers. */
export function LayerToggles({ layers, onChange, disabled }: {
  layers: OverlayLayers
  onChange: (layers: OverlayLayers) => void
  disabled: boolean
}) {
  return <div className={styles.group} role="group" aria-label="Capas sobre la imagen">
    {options.map(({ key, label }) => {
      const on = layers[key]
      const Icon = on ? Eye : EyeOff
      // Labels depend on boxes being visible.
      const unavailable = disabled || (key === 'labels' && !layers.boxes)
      return <button key={key} type="button" className={styles.toggle} aria-pressed={on} disabled={unavailable}
        onClick={() => onChange({ ...layers, [key]: !on })}>
        <Icon size={16} strokeWidth={1.75} aria-hidden="true" />{label}
      </button>
    })}
  </div>
}
