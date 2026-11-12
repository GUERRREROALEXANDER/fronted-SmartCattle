import { useLayoutEffect, useRef, useState, type ReactNode, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import type { Group } from 'three'
import type { HerdAgent } from '../../../live/herdMotion'
import { heightAt } from '../kit/terrain/heightfield'

export interface FloatingLabel {
  id: string
  agent: HerdAgent
  /** Metres above the ground where the label floats. */
  height: number
  content: ReactNode
}

// Keeps labels under the app rail, tab bar and banners.
const Z_INDEX_RANGE = [10, 0]
const MIN_SLOTS = 8

/**
 * drei's <Html> owns a separate React root and unmounts it synchronously in a layout-effect cleanup.
 * Labels that come and go with live detections (a cow stepping out, a visitor leaving) would unmount
 * those roots while the scene is committing, which React rejects. The pool keeps a fixed set of <Html>
 * slots for the life of the scene (it only grows) and reassigns them to whoever needs a label.
 */
export function LabelPool({ labels, portal }: { labels: readonly FloatingLabel[]; portal: RefObject<HTMLElement> }) {
  const [slots, setSlots] = useState(MIN_SLOTS)
  // High-water mark, adjusted during render: more labels mount new slots, fewer never unmount any.
  if (labels.length > slots) setSlots(Math.ceil(labels.length / MIN_SLOTS) * MIN_SLOTS)
  return <>
    {Array.from({ length: slots }, (_, index) => <LabelSlot key={index} label={labels[index] ?? null} portal={portal} />)}
  </>
}

function LabelSlot({ label, portal }: { label: FloatingLabel | null; portal: RefObject<HTMLElement> }) {
  const groupRef = useRef<Group>(null)
  const current = useRef(label)
  useLayoutEffect(() => { current.current = label })

  useFrame(() => {
    const group = groupRef.current
    if (!group) return
    const active = current.current
    group.visible = active !== null
    if (!active) return
    const { x, z } = active.agent.position
    group.position.set(x, heightAt(x, z), z)
  })

  return (
    <group ref={groupRef}>
      <Html portal={portal} position={[0, label?.height ?? 2, 0]} center zIndexRange={Z_INDEX_RANGE} pointerEvents="none">
        {label?.content ?? null}
      </Html>
    </group>
  )
}
