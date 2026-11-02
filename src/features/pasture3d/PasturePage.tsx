import { lazy, Suspense, useMemo, useState } from 'react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { OctagonAlert, UserRound } from 'lucide-react'
import { ConnectionChip, ErrorState, PageHeader } from '../../components/ui'
import { describeApiError } from '../../api/errors'
import { zoneSummaries, useExitLog } from '../../live/herdSummary'
import { herdCount } from '../../live/liveState'
import { useNow } from '../../lib/useNow'
import { AlertCenter } from '../dashboard/AlertCenter'
import { LiveMetrics } from '../dashboard/LiveMetrics'
import { useFarmLive, useHerdMotion } from '../../live/useHerdMotion'
import { duration, ease, FadeUp, staggerDelay } from '../../motion'
import { buildCameraPresets, OVERVIEW_PRESET_ID } from './scene/cameraPresets'
import { SceneErrorBoundary } from './scene/SceneErrorBoundary'
import { planPointToWorld, sceneLots } from './scene/sceneLots'
import { isWebGLAvailable } from './scene/webgl'
import { ExitLog } from './ui/ExitLog'
import { SceneControls } from './ui/SceneControls'
import { SceneFallback } from './ui/SceneFallback'
import { ZonePanel } from './ui/ZonePanel'
import styles from './PasturePage.module.css'

// three.js loads after the page shell, behind the skeleton.
const PastureScene = lazy(() => import('./scene/PastureScene').then(module => ({ default: module.PastureScene })))

const NO_PLAN_COPY = 'Registra la finca y sus lotes, o conecta una cámara de la IA, para ver el potrero en 3D.'

export function PasturePage() {
  const reduce = useReducedMotion() === true
  const { live, plan, entities } = useFarmLive()
  const planData = plan.data ?? null
  const motionConfig = useMemo(() => ({
    toSpace: (point: { x: number; y: number }) => planPointToWorld({ width: 800, height: 520 }, point),
    cowSpeed: 1.1, personSpeed: 1.3, arriveRadius: 0.25,
  }), [])
  const herd = useHerdMotion(planData, entities, motionConfig, reduce)
  const zones = useMemo(() => planData ? zoneSummaries(planData, entities) : [], [planData, entities])
  const { log, announcement } = useExitLog(planData, entities)
  const presets = useMemo(() => buildCameraPresets(planData ? sceneLots(planData) : []), [planData])
  const [camera, setCamera] = useState({ id: OVERVIEW_PRESET_ID, request: 0 })
  const [showNames, setShowNames] = useState(false)
  const [webgl] = useState(isWebGLAvailable)
  const preset = presets.find(item => item.id === camera.id) ?? presets[0]
  const breached = zones.filter(zone => zone.breached)
  const people = entities.filter(entity => entity.kind === 'person').length
  const cameraStatus = useMemo(() => new Map(live.cameras.map(item => [item.id, item.status])), [live.cameras])
  const cameraNames = useMemo(() => new Map(live.cameras.map(item => [item.id, item.name])), [live.cameras])

  const now = useNow()
  const count = herdCount(live)

  const selectPreset = (id: string) => setCamera(previous => ({ id, request: previous.request + 1 }))

  return (
    <div className={styles.page}>
      <FadeUp className={styles.head}>
        <PageHeader title="Potrero 3D" actions={<ConnectionChip connection={live.connection} />} />
        <p className={styles.intro} id="pasture-help">
          La finca con lo que ven las cámaras ahora mismo: cada vaca y cada persona que detecta la IA aparece en su
          lote. Arrastra para girar, usa la rueda o pellizca para acercar. Cuando una vaca sale de su zona segura, la
          cerca de ese lote se marca en rojo.
        </p>
      </FadeUp>

      {/* The same live numbers as the dashboard, so the scene and the counts never disagree. */}
      <LiveMetrics className={styles.metrics} staggerFrom={1} count={count} history={live.history} metrics={live.metrics}
        cameras={live.cameras} alerts={live.alerts} reduceMotion={reduce} />

      {plan.status === 'error' && !planData ? (
        <ErrorState {...describeApiError(plan.error)} />
      ) : plan.status === 'success' && !planData ? (
        <ErrorState title="Todavía no hay finca para dibujar" description={NO_PLAN_COPY} />
      ) : (
        <div className={styles.layout}>
          <FadeUp delay={staggerDelay(1)} className={styles.stageSlot}>
            <section className={styles.stage} aria-label="Escena 3D del potrero" aria-describedby="pasture-help">
              <div className={styles.frame}>
                <div className={styles.canvas}>
                  {!planData || !preset ? (
                    <SceneFallback reason="loading" />
                  ) : webgl ? (
                    <SceneErrorBoundary fallback={<SceneFallback reason="unsupported" />}>
                      <Suspense fallback={<SceneFallback reason="loading" />}>
                        <PastureScene
                          plan={planData}
                          agents={herd.agents}
                          step={herd.step}
                          zones={zones}
                          cameraStatus={cameraStatus}
                          cameraNames={cameraNames}
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
                  <AnimatePresence>
                    {(breached.length > 0 || people > 0) && (
                      <motion.div
                        key="breach"
                        className={`${styles.banner} ${breached.length === 0 ? styles.bannerWarning : ''}`}
                        initial={{ opacity: 0, transform: reduce ? 'none' : 'translateY(-12px)' }}
                        animate={{ opacity: 1, transform: 'translateY(0px)' }}
                        exit={{ opacity: 0, transform: reduce ? 'none' : 'translateY(-12px)' }}
                        transition={{ duration: reduce ? duration.micro : duration.state, ease: ease.out }}
                      >
                        {breached.length > 0
                          ? <OctagonAlert size={18} strokeWidth={2} aria-hidden="true" />
                          : <UserRound size={18} strokeWidth={2} aria-hidden="true" />}
                        <span>
                          {breached.length > 0 && `Vacas fuera de zona en ${breached.map(zone => `${zone.lotName} (${zone.outside})`).join(', ')}`}
                          {breached.length > 0 && people > 0 && ' · '}
                          {people > 0 && (people === 1 ? '1 persona en la finca' : `${people} personas en la finca`)}
                        </span>
                      </motion.div>
                    )}
                  </AnimatePresence>
                  {/* Floating chips never take pointer events, so the canvas keeps every drag and pinch. */}
                  {preset && <div className={styles.chips}>
                    <span className={styles.chip}>{preset.label}</span>
                  </div>}
                </div>
              </div>

              <SceneControls
                showNames={showNames}
                presets={presets}
                activePresetId={camera.id}
                onToggleNames={() => setShowNames(value => !value)}
                onSelectPreset={selectPreset}
              />
            </section>
          </FadeUp>

          <FadeUp delay={staggerDelay(2)} className={styles.side}>
            <ZonePanel zones={zones} activePresetId={camera.id} onSelect={selectPreset} />
            <AlertCenter alerts={live.alerts} cameras={live.cameras} now={now} onAction={live.updateAlert} reduceMotion={reduce} />
            <ExitLog entries={log} />
          </FadeUp>
        </div>
      )}

      <div className="visually-hidden" aria-live="polite" aria-atomic="true">
        {announcement}
      </div>
    </div>
  )
}
