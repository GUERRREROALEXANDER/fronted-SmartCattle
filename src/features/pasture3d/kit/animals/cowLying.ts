import { MathUtils, Quaternion, Vector3 } from 'three'
import type { AnimationClip, Object3D } from 'three'

// The model has no clip for lying down, so the pose is built on its skeleton: the legs really fold, on top of whatever
// the idle clip is doing. All angles are in the model's own space, so they do not depend on how each bone was rigged.

/** How long getting down or up takes, as a cow does it: not in one go. */
export const LYING_SECONDS = 2.8

/** How far the body comes down until the chest rests on the ground, in metres. */
export const LYING_DROP = 0.6

/** How much the nose dips while only the front legs are folded, in radians. */
const NOSE_DIP = 0.3

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))
const smooth = (value: number) => { const t = clamp01(value); return t * t * (3 - 2 * t) }

export interface LyingPhases {
  /** 0 standing, 1 folded. */
  front: number
  hind: number
  drop: number
  /** Positive: the nose is lower than the rump. */
  pitch: number
}

/**
 * Going down, the front legs fold first and the rump follows. Coming up the same curve runs backwards, so the rump
 * rises first, which is also how a cow gets up.
 */
export function lyingPhases(rest: number): LyingPhases {
  const front = smooth(rest / 0.55)
  const hind = smooth((rest - 0.3) / 0.7)
  return { front, hind, drop: LYING_DROP * (0.55 * front + 0.45 * hind), pitch: NOSE_DIP * (front - hind) }
}

/** Moves toward lying or standing at a steady pace, so a change of mind halfway turns around from where it is. */
export function stepRest(rest: number, lying: boolean, delta: number, instant = false): number {
  const target = lying ? 1 : 0
  if (instant) return target
  const step = delta / LYING_SECONDS
  return rest + MathUtils.clamp(target - rest, -step, step)
}

type Phase = 'front' | 'hind'

// In the model's space a negative angle swings the hoof forward and a positive one back. The roll opens the leg
// outward, so the folded hind legs show beside the belly instead of passing through it.
const FOLDS: readonly { bone: string; phase: Phase; angle: number; roll?: number }[] = [
  // Knee forward on the ground, shin tucked straight back under the chest.
  { bone: 'FrontUpperLeg', phase: 'front', angle: -1.25 },
  { bone: 'FrontLowerLeg', phase: 'front', angle: 2.67 },
  // Thigh forward along the flank, hock back by the rump, shin flat on the ground with the hoof forward.
  { bone: 'BackLeg', phase: 'hind', angle: -0.65, roll: 0.3 },
  { bone: 'BackUpperLeg', phase: 'hind', angle: 1.11 },
  { bone: 'BackLowerLeg', phase: 'hind', angle: -1.82 },
]

const LATERAL = new Vector3(1, 0, 0)
const FORWARD = new Vector3(0, 0, 1)
const UP = new Vector3(0, 1, 0)

interface Joint {
  bone: Object3D
  phase: Phase
  angle: number
  roll: number
  /** The model's axes, in the frame the bone's rotation is written in. */
  lateral: Vector3
  forward: Vector3
  /** Bones no clip writes would otherwise add this rotation up, frame after frame. */
  base: Quaternion | null
}

interface Neck { bone: Object3D; up: Vector3; lateral: Vector3; base: Quaternion | null }

export interface LyingRig { joints: Joint[]; neck: Neck | null; head: Neck | null }

function axesOf(bone: Object3D) {
  const toParent = new Quaternion()
  bone.parent?.getWorldQuaternion(toParent)
  toParent.invert()
  return {
    lateral: LATERAL.clone().applyQuaternion(toParent),
    forward: FORWARD.clone().applyQuaternion(toParent),
    up: UP.clone().applyQuaternion(toParent),
  }
}

/** Reads the bones once, in the rest pose of a freshly cloned model. */
export function createLyingRig(model: Object3D, clips: readonly AnimationClip[]): LyingRig {
  model.updateMatrixWorld(true)
  const written = new Set(clips.flatMap(clip => clip.tracks.map(track => track.name)))
  const baseOf = (bone: Object3D) => written.has(`${bone.name}.quaternion`) ? null : bone.quaternion.clone()
  const joints: Joint[] = []
  for (const fold of FOLDS) {
    for (const [side, outward] of [['L', 1], ['R', -1]] as const) {
      // The loader drops the dot of "FrontUpperLeg.L" from node names.
      const bone = model.getObjectByName(`${fold.bone}${side}`) ?? model.getObjectByName(`${fold.bone}.${side}`)
      if (!bone) continue
      const { lateral, forward } = axesOf(bone)
      joints.push({ bone, phase: fold.phase, angle: fold.angle, roll: (fold.roll ?? 0) * outward, lateral, forward, base: baseOf(bone) })
    }
  }
  const neckOf = (name: string): Neck | null => {
    const bone = model.getObjectByName(name)
    if (!bone) return null
    const { up, lateral } = axesOf(bone)
    return { bone, up, lateral, base: baseOf(bone) }
  }
  return { joints, neck: neckOf('Neck1'), head: neckOf('Head') }
}

const turn = new Quaternion()

function rotate(bone: Object3D, axis: Vector3, angle: number) {
  if (angle === 0) return
  bone.quaternion.premultiply(turn.setFromAxisAngle(axis, angle))
}

/** Call after the mixer has written this frame's clip pose. `clock` drives the head; pass a constant to keep it still. */
export function poseLying(rig: LyingRig, phases: LyingPhases, clock: number) {
  for (const joint of rig.joints) {
    if (joint.base) joint.bone.quaternion.copy(joint.base)
    const amount = joint.phase === 'front' ? phases.front : phases.hind
    rotate(joint.bone, joint.lateral, joint.angle * amount)
    rotate(joint.bone, joint.forward, joint.roll * amount)
  }
  // Settled, it looks around slowly and chews: what tells a resting animal from a sick one.
  const settled = Math.min(phases.front, phases.hind)
  if (rig.neck) {
    if (rig.neck.base) rig.neck.bone.quaternion.copy(rig.neck.base)
    rotate(rig.neck.bone, rig.neck.up, settled * 0.22 * Math.sin(clock * 0.31))
  }
  if (rig.head) {
    if (rig.head.base) rig.head.bone.quaternion.copy(rig.head.base)
    rotate(rig.head.bone, rig.head.lateral, settled * 0.03 * Math.sin(clock * 5.2))
  }
}
