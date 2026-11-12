import { useEffect } from 'react'
import { Canvas, advance, useThree } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import { MeshBasicMaterial, OrthographicCamera, type AnimationClip, type Object3D } from 'three'
import { Cow, type CowPose } from '../pasture3d/kit/animals/Cow'
import { COW_MODEL_URL, prepareCowTemplate } from '../pasture3d/kit/animals/cowModel'
import { heightAt } from '../pasture3d/kit/terrain/heightfield'

// Development tool, reached through scripts/render-herd-sprites.mjs: photographs the approved cow model
// from the side as flat ink, so the printed herd on the posters is that same animal.

const SIZE = { width: 320, height: 200 }
const WALK_FRAMES = 8
const ground = heightAt(0, 0)
const silhouette = new MeshBasicMaterial({ color: '#000000' })
const pose: CowPose = {
  id: 'sprite', coat: 'holstein', position: { x: 0, z: 0 }, heading: 0, state: 'walking', speed: 1, escapeRequested: false, posture: 'walking',
}

function Rig() {
  const gl = useThree(state => state.gl)
  const scene = useThree(state => state.scene)
  const set = useThree(state => state.set)
  const gltf = useGLTF(COW_MODEL_URL, false) as unknown as { scene: Object3D; animations: AnimationClip[] }
  useEffect(() => {
    const view = new OrthographicCamera(-2, 2, 2.5, 0, 0.1, 100)
    // Manual: the fitted frustum must survive the canvas resizing it to pixels.
    Object.assign(view, { manual: true })
    view.position.set(0, ground, 20)
    view.lookAt(0, ground, 0)
    view.updateProjectionMatrix()
    set({ camera: view })
    Object.assign(scene, { overrideMaterial: silhouette })
    gl.setClearAlpha(0)
    const template = prepareCowTemplate(gltf)
    const walk = template.animations.find(clip => clip.name === 'Walk')?.duration ?? 1
    pose.speed = template.naturalSpeed
    const capture = async () => {
      const sheet = document.createElement('canvas')
      sheet.width = SIZE.width * (WALK_FRAMES + 2)
      sheet.height = SIZE.height
      const context = sheet.getContext('2d')!
      let time = 0
      const to = (next: number) => { time = next; advance(time) }
      const shot = () => context.canvas && gl.domElement
      // Long enough for the gait blend to settle before the first frame.
      for (let index = 1; index <= 60; index++) to(index * 0.05)
      for (let frame = 0; frame < WALK_FRAMES; frame++) {
        to(time + walk / WALK_FRAMES)
        if (shot()) context.drawImage(gl.domElement, frame * SIZE.width, 0)
      }
      pose.state = 'grazing'
      pose.posture = 'standing'
      pose.speed = 0
      for (let index = 1; index <= 60; index++) to(time + 0.05)
      context.drawImage(gl.domElement, WALK_FRAMES * SIZE.width, 0)
      // Lying: the same resting body lowered until the ground hides its legs, as the 3D scene does it.
      pose.posture = 'lying'
      for (let index = 1; index <= 120; index++) to(time + 0.05)
      context.drawImage(gl.domElement, (WALK_FRAMES + 1) * SIZE.width, 0)
      context.clearRect((WALK_FRAMES + 1) * SIZE.width, SIZE.height - 2, SIZE.width, 2)
      return sheet.toDataURL('image/png')
    }
    Object.assign(window, { __captureHerd: capture })
    return () => { Object.assign(scene, { overrideMaterial: null }) }
  }, [gl, gltf, scene, set])
  return <Cow cow={pose} />
}

export function SpriteRigPage() {
  return <div style={{ width: SIZE.width, height: SIZE.height }}>
    <Canvas frameloop="never" dpr={1} flat gl={{ alpha: true, preserveDrawingBuffer: true, antialias: true }}><Rig /></Canvas>
  </div>
}
