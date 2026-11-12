import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import type { ReactNode } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { useReducedMotion } from 'motion/react'
import {
  AnimationMixer,
  LoopRepeat,
  MathUtils,
  MeshBasicMaterial,
  RingGeometry,
} from 'three'
import type { AnimationAction, AnimationClip, Group, Object3D, SkinnedMesh } from 'three'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { CowCoat } from '../../../../live/herdMotion'
import { ALERT_COLOR } from '../materials'
import { hashString } from '../noise'
import { heightAt } from '../terrain/heightfield'
import { alertPulse, COW_MODEL_URL, cowMaterial, prepareCowTemplate } from './cowModel'

/** What the model reads every frame; the live herd agents provide it. */
export interface CowPose {
  id: string
  coat: CowCoat
  position: { x: number; z: number }
  heading: number
  state: 'grazing' | 'walking' | 'returning'
  speed: number
  escapeRequested: boolean
  /** 0 → 1 while the animal appears, 1 → 0 while it leaves the picture. Defaults to 1. */
  presence?: number
  /** What the AI estimates it is doing, when live data says. */
  posture?: 'standing' | 'walking' | 'lying' | null
}

/** How far the body sinks to rest on the ground: the model has no lying animation, so its legs fold out of sight. */
const LYING_DROP = 0.62

/** Appear and leave from 90 % size, never from nothing. */
function presenceScale(presence = 1): number {
  return 0.9 + 0.1 * Math.min(1, Math.max(0, presence))
}

export interface CowProps {
  cow: CowPose
  /** Outside its lot: red rim light and a pulsing ring on the ground. */
  alert?: boolean
  paused?: boolean
  children?: ReactNode
}

type Mode = 'walk' | 'eat' | 'idle' | 'look'
const CLIPS: Record<Mode, string> = { walk: 'Walk', eat: 'Eating', idle: 'Idle', look: 'Idle_Headlow' }
const MODES = Object.keys(CLIPS) as Mode[]

const ringGeometry = new RingGeometry(1.35, 1.6, 48).rotateX(-Math.PI / 2)
const ringMaterial = new MeshBasicMaterial({ color: ALERT_COLOR, transparent: true, opacity: 0.8, depthWrite: false, toneMapped: false })

useGLTF.preload(COW_MODEL_URL, false)

export function Cow({ cow, alert = false, paused = false, children }: CowProps) {
  const gltf = useGLTF(COW_MODEL_URL, false) as unknown as { scene: Object3D; animations: AnimationClip[] }
  const template = useMemo(() => prepareCowTemplate(gltf), [gltf])
  const model = useMemo(() => cloneSkinned(template.scene), [template])
  const seed = useMemo(() => hashString(cow.id), [cow.id])
  const variant = Math.floor(seed * 3)
  const rootRef = useRef<Group>(null)
  const ringRef = useRef<Group>(null)
  const shouldReduceMotion = useReducedMotion()
  const blend = useRef({ weights: { walk: 0, eat: 1, idle: 0, look: 0 } as Record<Mode, number>, clock: seed * 20, lying: 0 })

  const rig = useMemo(() => {
    const mixer = new AnimationMixer(model)
    const actions = {} as Record<Mode, AnimationAction | undefined>
    for (const mode of MODES) {
      const clip = template.animations.find(item => item.name === CLIPS[mode])
      if (!clip) continue
      const action = mixer.clipAction(clip)
      action.setLoop(LoopRepeat, Infinity)
      action.play()
      action.time = seed * clip.duration
      action.setEffectiveWeight(0)
      actions[mode] = action
    }
    return { mixer, actions }
  }, [model, seed, template.animations])

  useEffect(() => () => {
    rig.mixer.stopAllAction()
    rig.mixer.uncacheRoot(model)
  }, [model, rig])

  useLayoutEffect(() => {
    model.traverse(object => {
      const mesh = object as SkinnedMesh
      if (!mesh.isSkinnedMesh) return
      const part = String(mesh.userData.part)
      const body = part === 'Main' || part === 'Main_Light'
      Object.assign(mesh, {
        material: cowMaterial(part, cow.coat, variant, alert, template.bounds),
        castShadow: body,
        receiveShadow: body,
        // Skinned bounds don't follow the animation.
        frustumCulled: false,
      })
    })
  }, [alert, cow.coat, model, template.bounds, variant])

  useFrame((state, delta) => {
    const root = rootRef.current
    if (root) {
      const rest = shouldReduceMotion ? (cow.posture === 'lying' ? 1 : 0)
        : MathUtils.lerp(blend.current.lying, cow.posture === 'lying' ? 1 : 0, 1 - Math.exp(-delta * 2.5))
      blend.current.lying = rest
      root.position.set(cow.position.x, heightAt(cow.position.x, cow.position.z) - rest * LYING_DROP, cow.position.z)
      root.rotation.y = -cow.heading
      root.scale.setScalar(presenceScale(cow.presence))
      root.visible = (cow.presence ?? 1) > 0.02
    }
    if (alert) {
      alertPulse.value = shouldReduceMotion ? 1 : 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 4)
      ringRef.current?.scale.setScalar(shouldReduceMotion ? 1 : 1 + 0.08 * Math.sin(state.clock.elapsedTime * 4))
    }
    if (paused) return

    // The AI's word decides the gait: walking when it says walking, however little the box moved; never
    // while it says lying. Without a word, the gait follows the movement.
    const walking = cow.posture === 'walking' || (cow.state !== 'grazing' && cow.posture !== 'lying')
    const motion = blend.current
    motion.clock += delta
    // Grazing cows mostly eat, lifting the head now and then.
    const cycle = motion.clock % 22
    const resting: Mode = cycle < 14 ? 'eat' : cycle < 18 ? 'look' : 'idle'
    // Grazing for show would claim something the AI never said, so an animal with no reported posture just stands.
    const mode: Mode = walking ? 'walk' : cow.posture === 'standing' && cycle >= 16 ? 'look' : cow.posture === undefined ? resting : 'idle'
    const fade = shouldReduceMotion ? 1 : 1 - Math.exp(-delta * 4)
    for (const key of MODES) {
      motion.weights[key] = MathUtils.lerp(motion.weights[key], key === mode ? 1 : 0, fade)
      rig.actions[key]?.setEffectiveWeight(motion.weights[key])
    }
    const walk = rig.actions.walk
    if (walk) {
      const pace = cow.speed * (cow.state === 'returning' ? 1.2 : cow.escapeRequested ? 1.35 : 1)
      walk.setEffectiveTimeScale(MathUtils.clamp(pace / template.naturalSpeed, 0.5, 1.9))
    }
    rig.mixer.update(shouldReduceMotion ? 0 : delta)
  })

  return (
    <group ref={rootRef} position={[cow.position.x, 0, cow.position.z]} rotation={[0, -cow.heading, 0]}>
      {/* The model's muzzle points to +Z; the simulation's heading points to +X. */}
      <group rotation={[0, Math.PI / 2, 0]}>
        <group position={template.offset} scale={template.scale}>
          <primitive object={model} />
        </group>
      </group>
      {alert && (
        <group ref={ringRef} position={[0, 0.06, 0]}>
          <mesh geometry={ringGeometry} material={ringMaterial} renderOrder={3} />
        </group>
      )}
      {children}
    </group>
  )
}
