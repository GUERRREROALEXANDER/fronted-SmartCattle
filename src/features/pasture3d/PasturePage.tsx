import { lazy, Suspense, useMemo, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import { FlaskConical, OctagonAlert } from 'lucide-react'
import { PageHeader } from '../../components/ui'
import { FadeUp } from '../../motion'
import { mockFarmPlan } from '../../mocks/mockFarmPlan'
import { buildCameraPresets, OVERVIEW_PRESET_ID } from './scene/cameraPresets'
import { SceneErrorBoundary } from './scene/SceneErrorBoundary'
import { isWebGLAvailable } from './scene/webgl'
import { useHerdSimulation } from './simulation/useHerdSimulation'
import { ExitLog } from './ui/ExitLog'
import { SceneControls } from './ui/SceneControls'
import { SceneFallback } from './ui/SceneFallback'
import { ZonePanel } from './ui/ZonePanel'
import styles from './PasturePage.module.css'

// three.js loads after the page shell, behind the skeleton.
const PastureScene = lazy(() => import('./scene/PastureScene').then(module => ({ default: module.PastureScene })))

export function PasturePage() {
  const reduce = useReducedMotion() === true
  const herd = useHerdSimulation({ plan: mockFarmPlan, startPaused: reduce })
  const presets = useMemo(() => buildCameraPresets(herd.simulation.lots), [herd.simulation])
  const [camera, setCamera] = useState({ id: OVERVIEW_PRESET_ID, request: 0 })
  const [showNames, setShowNames] = useState(false)
  const [webgl] = useState(isWebGLAvailable)
  const [hint, setHint] = useState('')
  const preset = presets.find(item => item.id === camera.id) ?? presets[0]
  const breached = herd.zones.filter(zone => zone.breached)

  const selectPreset = (id: string) => setCamera(previous => ({ id, request: previous.request + 1 }))
  const forceEscape = () => {
    const result = herd.forceEscape()
    if (!result) {
      setHint('Todas las vacas ya están fuera o saliendo de su zona.')
      return
    }
    setHint('')
    selectPreset(result.lotId)
  }

  return (
    <div className={styles.page}>
      <PageHeader title="Potrero 3D" actions={
        <span className={styles.demo}>
          <FlaskConical size={16} strokeWidth={1.75} aria-hidden="true" />
          Simulación de demostración
        </span>
      } />
      <p className={styles.intro} id="pasture-help">
        Vista simulada de la finca con sus zonas seguras. Arrastra para girar, usa la rueda o pellizca para
        acercar. Cuando una vaca sale de su lote, la cerca de ese lote se marca en rojo.
      </p>

      <div className={styles.layout}>
        <section className={styles.stage} aria-label="Escena 3D del potrero" aria-describedby="pasture-help">
          <div className={styles.canvas}>
            {webgl ? (
              <SceneErrorBoundary fallback={<SceneFallback reason="unsupported" />}>
                <Suspense fallback={<SceneFallback reason="loading" />}>
                  <PastureScene
                    plan={mockFarmPlan}
                    herd={herd}
                    preset={preset}
                    presetRequest={camera.request}
                    showNames={showNames}
                    reduceMotion={reduce}
                  />
                </Suspense>
              </SceneErrorBoundary>
            ) : (
              <SceneFallback reason="unsupported" />
            )}
            {breached.length > 0 && (
              <div className={styles.banner}>
                <OctagonAlert size={18} strokeWidth={2} aria-hidden="true" />
                <span>
                  Vacas fuera de zona en {breached.map(zone => `${zone.lotName} (${zone.outside})`).join(', ')}
                </span>
              </div>
            )}
            {herd.paused && <span className={styles.pausedTag}>En pausa</span>}
          </div>

          <SceneControls
            paused={herd.paused}
            showNames={showNames}
            presets={presets}
            activePresetId={camera.id}
            onTogglePaused={() => herd.setPaused(!herd.paused)}
            onForceEscape={forceEscape}
            onToggleNames={() => setShowNames(value => !value)}
            onSelectPreset={selectPreset}
          />
          {hint && <p className={styles.hint}>{hint}</p>}
        </section>

        <FadeUp className={styles.side}>
          <ZonePanel zones={herd.zones} activePresetId={camera.id} onSelect={selectPreset} />
          <ExitLog entries={herd.log} />
        </FadeUp>
      </div>

      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {herd.announcement}
      </div>
    </div>
  )
}
