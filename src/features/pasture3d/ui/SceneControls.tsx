import { CheckSquare, Pause, Play, Square, TriangleAlert } from 'lucide-react'
import { Button } from '../../../components/ui'
import type { CameraPreset } from '../scene/cameraPresets'
import styles from './SceneControls.module.css'

export interface SceneControlsProps {
  paused: boolean
  showNames: boolean
  presets: readonly CameraPreset[]
  activePresetId: string
  onTogglePaused: () => void
  onForceEscape: () => void
  onToggleNames: () => void
  onSelectPreset: (presetId: string) => void
}

export function SceneControls({
  paused,
  showNames,
  presets,
  activePresetId,
  onTogglePaused,
  onForceEscape,
  onToggleNames,
  onSelectPreset,
}: SceneControlsProps) {
  return (
    <div className={styles.controls}>
      <div className={styles.group} role="group" aria-label="Simulación">
        <Button variant={paused ? 'primary' : 'secondary'} icon={paused ? Play : Pause} onClick={onTogglePaused}>
          {paused ? 'Reanudar' : 'Pausar'}
        </Button>
        <Button variant="secondary" icon={TriangleAlert} onClick={onForceEscape}>
          Provocar salida
        </Button>
        <Button variant={showNames ? 'secondary' : 'ghost'} icon={showNames ? CheckSquare : Square}
          aria-pressed={showNames} onClick={onToggleNames}>
          Mostrar nombres
        </Button>
      </div>
      <div className={styles.group} role="group" aria-label="Vistas de cámara">
        {presets.map(preset => (
          <button
            key={preset.id}
            type="button"
            className={styles.preset}
            aria-pressed={activePresetId === preset.id}
            onClick={() => onSelectPreset(preset.id)}
          >
            {preset.label}
          </button>
        ))}
      </div>
    </div>
  )
}
