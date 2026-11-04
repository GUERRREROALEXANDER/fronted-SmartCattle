import { useMemo, useRef, useState, type RefObject } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import type { MotionValue } from 'motion/react'
import { ACESFilmicToneMapping, Color, Vector3 } from 'three'
import { buildFarmPlan } from '../../services/farmLayout'
import { lotPoint } from '../../live/herdTracker'
import { Cow, type CowPose } from '../pasture3d/kit/animals/Cow'
import { Sky } from '../pasture3d/kit/environment/Sky'
import { SUN_DIRECTION } from '../pasture3d/kit/environment/sun'
import { PerimeterFence } from '../pasture3d/kit/fences/PerimeterFence'
import { ZoneFence } from '../pasture3d/kit/fences/ZoneFence'
import { palette } from '../pasture3d/kit/materials'
import { Grass } from '../pasture3d/kit/nature/Grass'
import { Rocks } from '../pasture3d/kit/nature/Rocks'
import { Trees } from '../pasture3d/kit/nature/Trees'
import { Barn } from '../pasture3d/kit/structures/Barn'
import { CameraPole } from '../pasture3d/kit/structures/CameraPole'
import { Ground } from '../pasture3d/kit/terrain/Ground'
import { extendTrack } from '../pasture3d/kit/terrain/paths'
import { heightAt } from '../pasture3d/kit/terrain/heightfield'
import { Track } from '../pasture3d/kit/terrain/Track'
import { planPointToWorld, sceneLots, sceneTrack } from '../pasture3d/scene/sceneLots'
import { BARN_POSITION, buildCameraPoles, buildScenery, PERIMETER } from '../pasture3d/scene/scenery'
import styles from './LandingPage.module.css'

// The approved pasture, run by a script instead of by a camera: an illustrative farm for the public page.
// The page labels it as a simulation.

const plan = buildFarmPlan(
  [{ id: 'demo-lot', name: 'Potrero', kind: 'pasture', areaSquareMeters: 9000, capacity: 30, cameraId: 'demo-cam', active: true }],
  [{ id: 'demo-cam' }],
)!
const lots = sceneLots(plan)
const track = sceneTrack(plan)
const road = extendTrack(track)
const scenery = buildScenery(lots, road)
const poles = buildCameraPoles(plan)
const FOG = new Color(palette.fog)
const SUN = SUN_DIRECTION.clone().multiplyScalar(90).toArray()
const YARDS = [{ x: BARN_POSITION.x + 5.5, z: BARN_POSITION.z, radius: 5 }]
const CLEARINGS = [{ x: BARN_POSITION.x, z: BARN_POSITION.z - 1, radius: 7 }]

const at = (s: number, t: number) => planPointToWorld(plan, lotPoint(plan.lots[0], s, t))
const center = at(0.5, 0.55)
const FACE_AWAY = 0.7

type Caption = 'lying' | 'walking' | 'standing' | 'outside' | null

interface Actor { pose: CowPose & { posture: 'standing' | 'walking' | 'lying' }; from: { x: number; z: number }; to: { x: number; z: number } }

const actor = (id: string, coat: CowPose['coat'], from: { x: number; z: number }, to = from): Actor => ({
  pose: { id, coat, position: { ...from }, heading: Math.atan2(to.z - from.z, to.x - from.x) || FACE_AWAY, state: 'grazing', speed: 0, escapeRequested: false, posture: 'standing' },
  from, to,
})

const actors = {
  // Walks across the lot during the first beat.
  walker: actor('demo-walker', 'holstein', at(0.28, 0.42), at(0.62, 0.5)),
  // Stands, then lies down in the second beat.
  rester: actor('demo-rester', 'brown', at(0.44, 0.72)),
  // Leaves through the fence in the third beat.
  runner: actor('demo-runner', 'black', at(0.72, 0.8), at(0.74, 1.14)),
  extraA: actor('demo-a', 'cream', at(0.2, 0.7)),
  extraB: actor('demo-b', 'holstein', at(0.82, 0.32)),
  extraC: actor('demo-c', 'brown', at(0.56, 0.24)),
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const span = (progress: number, start: number, end: number) => clamp01((progress - start) / (end - start))

// Where the camera sits along the scroll: over the letters, down to the herd, then to the fence.
const SHOTS = [
  { at: 0, position: new Vector3(center.x - 4, 34, center.z + 62), target: new Vector3(center.x, 0, center.z) },
  { at: 0.2, position: new Vector3(center.x - 8, 9, center.z + 26), target: new Vector3(center.x, 0.5, center.z) },
  { at: 0.44, position: new Vector3(actors.rester.from.x - 9, 4.5, actors.rester.from.z + 11), target: new Vector3(actors.rester.from.x, 0.7, actors.rester.from.z) },
  // Holds here too: a phone's narrow view loses the animal as soon as the camera starts to leave.
  { at: 0.56, position: new Vector3(actors.rester.from.x - 9, 4.5, actors.rester.from.z + 11), target: new Vector3(actors.rester.from.x, 0.7, actors.rester.from.z) },
  { at: 0.66, position: new Vector3(actors.runner.to.x - 11, 4.5, actors.runner.to.z + 10), target: new Vector3(actors.runner.to.x, 0.8, actors.runner.to.z - 1) },
  // Holds on the animal for as long as the beat talks about it.
  { at: 0.88, position: new Vector3(actors.runner.to.x - 11, 4.5, actors.runner.to.z + 10), target: new Vector3(actors.runner.to.x, 0.8, actors.runner.to.z - 1) },
  { at: 1, position: new Vector3(center.x + 18, 16, center.z + 44), target: new Vector3(center.x, 0, center.z) },
]

function ScrollRig({ progress }: { progress: MotionValue<number> }) {
  const camera = useThree(state => state.camera)
  const position = useRef(SHOTS[0].position.clone())
  const target = useRef(SHOTS[0].target.clone())
  const goalPosition = useRef(new Vector3())
  const goalTarget = useRef(new Vector3())
  useFrame((_, delta) => {
    const p = progress.get()
    let index = 0
    while (index < SHOTS.length - 2 && p > SHOTS[index + 1].at) index++
    const [a, b] = [SHOTS[index], SHOTS[index + 1]]
    const t = span(p, a.at, b.at)
    const eased = t * t * (3 - 2 * t)
    goalPosition.current.lerpVectors(a.position, b.position, eased)
    goalTarget.current.lerpVectors(a.target, b.target, eased)
    // A short follow keeps a flicked wheel from jolting the view.
    const follow = 1 - Math.exp(-delta * 7)
    position.current.lerp(goalPosition.current, follow)
    target.current.lerp(goalTarget.current, follow)
    camera.position.copy(position.current)
    camera.lookAt(target.current)
  })
  return null
}

function Director({ progress, onBreach }: { progress: MotionValue<number>; onBreach: (breached: boolean) => void }) {
  const breached = useRef(false)
  useFrame(() => {
    const p = progress.get()
    // The walker really walks while the scroll moves it.
    const walk = span(p, 0.14, 0.42)
    const { walker, rester, runner } = actors
    walker.pose.position = { x: walker.from.x + (walker.to.x - walker.from.x) * walk, z: walker.from.z + (walker.to.z - walker.from.z) * walk }
    const walking = walk > 0 && walk < 1
    walker.pose.posture = walking ? 'walking' : 'standing'
    walker.pose.state = walking ? 'walking' : 'grazing'
    walker.pose.speed = walking ? 1.1 : 0

    rester.pose.posture = p > 0.4 ? 'lying' : 'standing'

    const run = span(p, 0.6, 0.74)
    runner.pose.position = { x: runner.from.x + (runner.to.x - runner.from.x) * run, z: runner.from.z + (runner.to.z - runner.from.z) * run }
    const running = run > 0 && run < 1
    runner.pose.posture = running ? 'walking' : 'standing'
    runner.pose.state = running ? 'returning' : 'grazing'
    runner.pose.speed = running ? 1.6 : 0
    const outside = run > 0.62
    if (outside !== breached.current) {
      breached.current = outside
      onBreach(outside)
    }
  })
  return null
}

const CAPTIONS: Record<Exclude<Caption, null>, { text: string; tone: string }> = {
  walking: { text: 'Caminando', tone: 'verde' },
  standing: { text: 'De pie', tone: 'cobalto' },
  lying: { text: 'Se echó', tone: 'fucsia' },
  outside: { text: 'Fuera de zona', tone: 'alarma' },
}

const projected = new Vector3()

/** Writes the caption and returns its size. Each new one stamps again, even when the last is still showing. */
function printCaption(place: HTMLElement, stamp: HTMLElement, caption: Caption) {
  place.hidden = caption === null
  if (!caption) return { width: 0, height: 0 }
  stamp.textContent = CAPTIONS[caption].text
  stamp.dataset.tone = CAPTIONS[caption].tone
  stamp.style.animation = 'none'
  const size = { width: place.offsetWidth, height: place.offsetHeight }
  stamp.style.animation = ''
  return size
}

function moveCaption(place: HTMLElement, left: number, top: number) {
  place.style.transform = `translate(${left}px, ${top}px)`
}

/**
 * A caption that lands on the animal, as soon as what it says becomes true. It lives in the page, not in the canvas,
 * and is written once a frame: it moves with the camera, so going through React for it would only cost.
 */
function CowCaption({ who, caption, progress, place }: { who: Actor; caption: (p: number) => Caption; progress: MotionValue<number>; place: RefObject<HTMLSpanElement | null> }) {
  const camera = useThree(state => state.camera)
  const size = useThree(state => state.size)
  const current = useRef<Caption>(null)
  const box = useRef({ width: 0, height: 0 })
  useFrame(() => {
    const element = place.current
    const stamp = element?.firstElementChild
    if (!(element && stamp instanceof HTMLElement)) return
    const next = caption(progress.get())
    if (next !== current.current) {
      current.current = next
      box.current = printCaption(element, stamp, next)
    }
    if (!next) return
    const { x, z } = who.pose.position
    // Right over the animal: higher, and from up close the caption lands on whichever cow stands behind it.
    projected.set(x, heightAt(x, z) + (next === 'lying' ? 1.35 : 1.9), z).project(camera)
    const { width, height } = box.current
    // On a phone the animal can sit near the edge: the words stay whole.
    const left = Math.min(size.width - width, Math.max(0, (projected.x + 1) / 2 * size.width - width / 2))
    const top = (1 - projected.y) / 2 * size.height - height / 2
    moveCaption(element, left, top)
  })
  return null
}

const walkerCaption = (p: number): Caption => p > 0.14 && p < 0.42 ? 'walking' : null
const resterCaption = (p: number): Caption => p > 0.36 && p <= 0.4 ? 'standing' : p > 0.4 && p < 0.62 ? 'lying' : null
const runnerCaption = (p: number): Caption => p > 0.68 && p < 0.9 ? 'outside' : null

export function LandingScene({ progress, reduceMotion, onBreach }: { progress: MotionValue<number>; reduceMotion: boolean; onBreach: (breached: boolean) => void }) {
  const [breached, setBreached] = useState(false)
  const breach = useMemo(() => (value: boolean) => { setBreached(value); onBreach(value) }, [onBreach])
  const walkerPlace = useRef<HTMLSpanElement>(null)
  const resterPlace = useRef<HTMLSpanElement>(null)
  const runnerPlace = useRef<HTMLSpanElement>(null)
  return <><Canvas
    dpr={[1, 1.5]}
    shadows="percentage"
    camera={{ position: SHOTS[0].position.toArray(), fov: 42, near: 0.3, far: 700 }}
    gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1 }}
  >
    <fog attach="fog" args={[FOG, 70, 340]} />
    <Sky fogColor={FOG} />
    <hemisphereLight args={['#cfe3ff', '#5a7a34', 0.45]} />
    <directionalLight position={SUN} intensity={3} color="#fff1dc" castShadow shadow-mapSize={[2048, 2048]} shadow-radius={4}
      shadow-bias={-0.0004} shadow-normalBias={0.03} shadow-camera-left={-62} shadow-camera-right={62} shadow-camera-top={48}
      shadow-camera-bottom={-48} shadow-camera-near={10} shadow-camera-far={200} />
    <Ground lots={lots} track={road} yards={YARDS} />
    <Track points={road} width={2.6} />
    <Grass lots={lots} track={road} clearings={CLEARINGS} windy={!reduceMotion} />
    <PerimeterFence halfX={PERIMETER.halfX} halfZ={PERIMETER.halfZ} track={road} />
    {lots.map(lot => <ZoneFence key={lot.id} lot={lot} track={track} breached={breached} />)}
    <Barn position={[BARN_POSITION.x, 0, BARN_POSITION.z]} />
    {poles.map(pole => <CameraPole key={pole.id} position={pole.position} heading={pole.heading} />)}
    <Trees trees={scenery.trees} />
    <Rocks clusters={scenery.rocks} />
    {Object.values(actors).map(item => <Cow key={item.pose.id} cow={item.pose} alert={item === actors.runner && breached} />)}
    <CowCaption who={actors.walker} caption={walkerCaption} progress={progress} place={walkerPlace} />
    <CowCaption who={actors.rester} caption={resterCaption} progress={progress} place={resterPlace} />
    <CowCaption who={actors.runner} caption={runnerCaption} progress={progress} place={runnerPlace} />
    <ScrollRig progress={progress} />
    <Director progress={progress} onBreach={breach} />
  </Canvas>
  <div className={styles.captions} aria-hidden="true">
    <span ref={walkerPlace} className={styles.captionPlace} hidden><span className={styles.caption} /></span>
    <span ref={resterPlace} className={styles.captionPlace} hidden><span className={styles.caption} /></span>
    <span ref={runnerPlace} className={styles.captionPlace} hidden><span className={styles.caption} /></span>
  </div></>
}
