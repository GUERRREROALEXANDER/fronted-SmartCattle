import { useMemo, useRef, type RefObject } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { Camera as CameraIcon, ScanEye, UserRound } from 'lucide-react'
import { Color, MeshBasicMaterial, RingGeometry, SphereGeometry } from 'three'
import type { Group, Mesh } from 'three'
import type { HerdAgent } from '../../../live/herdMotion'
import type { CameraStatus } from '../../../types/domain'
import { heightAt } from '../kit/terrain/heightfield'
import styles from './CowLabel.module.css'

// Live overlays drawn on top of the approved scene: they mark what the AI reports and never restyle
// the terrain, animals or structures.

const ARRIVAL_SECONDS = 0.9
const ringGeometry = new RingGeometry(0.92, 1, 48).rotateX(-Math.PI / 2)
const PERSON_COLOR = new Color('#f59e0b')
const ARRIVAL_COLOR = new Color('#e0f2e9')
const Z_INDEX_RANGE = [10, 0]

/**
 * Ground ring under an agent: a soft ping when it first appears (spatial consistency: it came from the
 * camera, it did not teleport) and, for people, a steady amber halo while they are on the farm.
 */
export function AgentRing({ agent, reduceMotion }: { agent: HerdAgent; reduceMotion: boolean }) {
  const groupRef = useRef<Group>(null)
  const pingRef = useRef<Mesh>(null)
  const haloRef = useRef<Mesh>(null)
  const pingMaterial = useRef<MeshBasicMaterial>(null)
  const haloMaterial = useRef<MeshBasicMaterial>(null)
  const person = agent.kind !== 'cow'

  useFrame(state => {
    const group = groupRef.current
    if (!group) return
    group.position.set(agent.position.x, heightAt(agent.position.x, agent.position.z) + 0.05, agent.position.z)
    const presence = Math.min(1, Math.max(0, agent.presence))
    const ping = pingRef.current
    if (ping) {
      const progress = Math.min(1, agent.age / ARRIVAL_SECONDS)
      // Strong ease-out: the ring leaves fast and settles, it never lingers on screen.
      const eased = 1 - (1 - progress) ** 4
      ping.visible = !reduceMotion && progress < 1
      ping.scale.setScalar(0.8 + eased * 1.8)
      if (pingMaterial.current) pingMaterial.current.opacity = (1 - eased) * 0.7
    }
    const halo = haloRef.current
    if (halo) {
      const breathe = reduceMotion ? 0 : Math.sin(state.clock.elapsedTime * 3) * 0.06
      halo.scale.setScalar((0.95 + breathe) * (0.9 + 0.1 * presence))
      if (haloMaterial.current) haloMaterial.current.opacity = 0.75 * presence
    }
  })

  return (
    <group ref={groupRef}>
      <mesh ref={pingRef} geometry={ringGeometry} renderOrder={3}>
        <meshBasicMaterial ref={pingMaterial} color={ARRIVAL_COLOR} transparent opacity={0} depthWrite={false} toneMapped={false} />
      </mesh>
      {person && <mesh ref={haloRef} geometry={ringGeometry} renderOrder={3} scale={0.95}>
        <meshBasicMaterial ref={haloMaterial} color={PERSON_COLOR} transparent opacity={0.75} depthWrite={false} toneMapped={false} />
      </mesh>}
    </group>
  )
}

/** Tag content for a detected person or unknown object, with the detector's confidence. */
export function DetectionLabel({ agent, lotName }: { agent: HerdAgent; lotName: string }) {
  const Icon = agent.kind === 'person' ? UserRound : ScanEye
  const confidence = agent.confidence === null ? '' : ` · ${Math.round(agent.confidence * 100)} %`
  return (
    <span className={`${styles.label} ${styles.person}`}>
      <Icon size={15} strokeWidth={2} aria-hidden="true" />
      {agent.kind === 'person' ? 'Persona' : agent.name} en {lotName}{confidence}
    </span>
  )
}

/** Unknown objects get a small beacon instead of a model: the AI saw something, not necessarily an animal. */
export function ObjectBeacon({ agent }: { agent: HerdAgent }) {
  const ref = useRef<Mesh>(null)
  const material = useMemo(() => new MeshBasicMaterial({ color: PERSON_COLOR, toneMapped: false }), [])
  const geometry = useMemo(() => new SphereGeometry(0.28, 20, 14), [])
  useFrame(() => {
    const mesh = ref.current
    if (!mesh) return
    mesh.position.set(agent.position.x, heightAt(agent.position.x, agent.position.z) + 0.6, agent.position.z)
    mesh.scale.setScalar(0.9 + 0.1 * agent.presence)
  })
  return <mesh ref={ref} geometry={geometry} material={material} />
}

const STATUS_COLOR: Record<CameraStatus, string> = {
  online: '#22c55e', connecting: '#38bdf8', offline: '#94a3b8', error: '#ef4444',
}
const STATUS_TEXT: Record<CameraStatus, string> = {
  online: 'En línea', connecting: 'Conectando', offline: 'Sin conexión', error: 'Con error',
}
const beaconGeometry = new SphereGeometry(0.11, 16, 12)

/**
 * Status light on top of a camera pole. Online cameras breathe slowly (state indication); offline and
 * failed ones stay still so motion itself means "this camera is alive".
 */
export function CameraBeacon({ position, status, label, showLabel, reduceMotion, portal }: {
  position: [number, number, number]
  status: CameraStatus
  label: string
  showLabel: boolean
  reduceMotion: boolean
  /** Stable DOM home for the label (see LabelPool). */
  portal: RefObject<HTMLElement>
}) {
  const ref = useRef<Mesh>(null)
  const material = useRef<MeshBasicMaterial>(null)
  const ground = useMemo(() => heightAt(position[0], position[2]), [position])
  useFrame(state => {
    const mesh = ref.current
    if (!mesh) return
    const alive = status === 'online' && !reduceMotion
    const wave = alive ? 0.5 + 0.5 * Math.sin(state.clock.elapsedTime * 2.2) : 1
    if (material.current) material.current.opacity = status === 'online' ? 0.55 + 0.45 * wave : 0.9
    mesh.scale.setScalar(alive ? 1 + 0.25 * wave : 1)
  })
  return (
    <group position={[position[0], ground + 3.62, position[2]]}>
      <mesh ref={ref} geometry={beaconGeometry}>
        <meshBasicMaterial ref={material} color={STATUS_COLOR[status]} transparent toneMapped={false} />
      </mesh>
      {/* Mounted for the camera's whole life; toggling only swaps its content (see LabelPool). */}
      <Html portal={portal} position={[0, 0.55, 0]} center zIndexRange={Z_INDEX_RANGE} pointerEvents="none">
        {showLabel && <span className={`${styles.label} ${styles.camera}`} data-status={status}>
          <CameraIcon size={14} strokeWidth={2} aria-hidden="true" />{label} · {STATUS_TEXT[status]}
        </span>}
      </Html>
    </group>
  )
}
