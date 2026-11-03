import { CheckSquare, Square } from 'lucide-react'
import { motion, useReducedMotion } from 'motion/react'
import { Button } from '../../../components/ui'
import type { CameraPreset } from '../scene/cameraPresets'
import styles from './SceneControls.module.css'

export interface SceneControlsProps {
  showNames: boolean
  presets: readonly CameraPreset[]
  activePresetId: string
  onToggleNames: () => void
  onSelectPreset: (presetId: string) => void
}

const indicatorSpring = { type: 'spring', stiffness: 380, damping: 30 } as const

export function SceneControls({
  showNames,
  presets,
  activePresetId,
  onToggleNames,
  onSelectPreset,
}: SceneControlsProps) {
  const reduce = useReducedMotion()

  return (
    <div className={styles.controls}>
      <div className={styles.group} role="group" aria-label="Opciones de la escena">
        <Button variant={showNames ? 'secondary' : 'ghost'} icon={showNames ? CheckSquare : Square}
          aria-pressed={showNames} onClick={onToggleNames}>
          Mostrar nombres y cámaras
        </Button>
      </div>
      <div className={styles.segmented} role="group" aria-label="Vistas de cámara">
        {presets.map(preset => {
          const active = activePresetId === preset.id
          return (
            <button
              key={preset.id}
              type="button"
              className={styles.preset}
              aria-pressed={active}
              onClick={() => onSelectPreset(preset.id)}
            >
              {active && (
                <motion.span
                  className={styles.indicator}
                  layoutId="pasture-preset-indicator"
                  aria-hidden="true"
                  transition={reduce ? { duration: 0 } : indicatorSpring}
                />
              )}
              {preset.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
