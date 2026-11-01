import { useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { ACESFilmicToneMapping, Color } from 'three'
import type { HerdAgent } from '../../../live/herdMotion'
import type { ZoneSummary } from '../../../live/herdSummary'
import type { FarmPlan } from '../../../services/farmLayout'
import type { CameraStatus } from '../../../types/domain'
import { Cow } from '../kit/animals/Cow'
import { Sky } from '../kit/environment/Sky'
import { SUN_DIRECTION } from '../kit/environment/sun'
import { PerimeterFence } from '../kit/fences/PerimeterFence'
import { ZoneFence } from '../kit/fences/ZoneFence'
import { palette } from '../kit/materials'
import { Grass } from '../kit/nature/Grass'
import { Rocks } from '../kit/nature/Rocks'
import { Trees } from '../kit/nature/Trees'
import { Person } from '../kit/people/Person'
import { Barn } from '../kit/structures/Barn'
import { CameraPole } from '../kit/structures/CameraPole'
import { WaterTrough } from '../kit/structures/WaterTrough'
import { Ground } from '../kit/terrain/Ground'
import { extendTrack } from '../kit/terrain/paths'
import { Track } from '../kit/terrain/Track'
import { CameraRig } from './CameraRig'
import type { CameraPreset } from './cameraPresets'
import { CowLabel } from './CowLabel'
import { AgentRing, CameraBeacon, DetectionLabel, ObjectBeacon } from './LiveMarkers'
import { sceneLots, sceneTrack } from './sceneLots'
import { BARN_POSITION, buildCameraPoles, buildScenery, PERIMETER, TROUGH_POSITION } from './scenery'

export interface PastureSceneProps {
  plan: FarmPlan
  agents: readonly HerdAgent[]
  /** Advances the live herd; called every frame. */
  step: (delta: number) => void
  zones: readonly ZoneSummary[]
  cameraStatus: ReadonlyMap<string, CameraStatus>
  cameraNames: ReadonlyMap<string, string>
  preset: CameraPreset
  presetRequest: number
  showNames: boolean
  reduceMotion: boolean
}

const SUN_POSITION = SUN_DIRECTION.clone().multiplyScalar(90).toArray()
const FOG_COLOR = new Color(palette.fog)
const YARDS = [
  { x: BARN_POSITION.x + 5.5, z: BARN_POSITION.z, radius: 5 },
  { x: TROUGH_POSITION.x, z: TROUGH_POSITION.z, radius: 3.2 },
]
const CLEARINGS = [
  { x: BARN_POSITION.x, z: BARN_POSITION.z - 1, radius: 7 },
  { x: TROUGH_POSITION.x, z: TROUGH_POSITION.z, radius: 1.8 },
]

function HerdDriver({ step }: { step: (delta: number) => void }) {
  useFrame((_, delta) => step(delta))
  return null
}

export function PastureScene({
  plan, agents, step, zones, cameraStatus, cameraNames, preset, presetRequest, showNames, reduceMotion,
}: PastureSceneProps) {
  const lots = useMemo(() => sceneLots(plan), [plan])
  const track = useMemo(() => sceneTrack(plan), [plan])
  const road = useMemo(() => extendTrack(track), [track])
  const scenery = useMemo(() => buildScenery(lots, road), [lots, road])
  const cameraPoles = useMemo(() => buildCameraPoles(plan), [plan])
  const breached = useMemo(() => new Set(zones.filter(zone => zone.breached).map(zone => zone.lotId)), [zones])
  const lotNames = useMemo(() => new Map(lots.map(lot => [lot.id, lot.name])), [lots])

  return (
    <Canvas
      dpr={[1, 1.75]}
      shadows="percentage"
      camera={{ position: preset.position, fov: 42, near: 0.3, far: 700 }}
      gl={{ antialias: true, powerPreference: 'high-performance', toneMapping: ACESFilmicToneMapping, toneMappingExposure: 1 }}
    >
      <fog attach="fog" args={[FOG_COLOR, 70, 340]} />
      <Sky fogColor={FOG_COLOR} />
      <hemisphereLight args={['#cfe3ff', '#5a7a34', 0.45]} />
      <directionalLight
        position={SUN_POSITION}
        intensity={3}
        color="#fff1dc"
        castShadow
        shadow-mapSize={[2048, 2048]}
        shadow-radius={4}
        shadow-bias={-0.0004}
        shadow-normalBias={0.03}
        shadow-camera-left={-62}
        shadow-camera-right={62}
        shadow-camera-top={48}
        shadow-camera-bottom={-48}
        shadow-camera-near={10}
        shadow-camera-far={200}
      />

      <Ground lots={lots} track={road} yards={YARDS} />
      <Track points={road} width={2.6} />
      <Grass lots={lots} track={road} clearings={CLEARINGS} windy={!reduceMotion} />

      <PerimeterFence halfX={PERIMETER.halfX} halfZ={PERIMETER.halfZ} track={road} />
      {lots.map(lot => (
        <ZoneFence key={lot.id} lot={lot} track={track} breached={breached.has(lot.id)} />
      ))}

      <Barn position={[BARN_POSITION.x, 0, BARN_POSITION.z]} />
      <WaterTrough position={[TROUGH_POSITION.x, 0, TROUGH_POSITION.z]} heading={Math.PI / 2} />
      {cameraPoles.map(pole => (
        <group key={pole.id}>
          <CameraPole position={pole.position} heading={pole.heading} />
          <CameraBeacon position={pole.position} status={cameraStatus.get(pole.id) ?? 'offline'}
            label={cameraNames.get(pole.id) ?? pole.id} showLabel={showNames} reduceMotion={reduceMotion} />
        </group>
      ))}
      <Trees trees={scenery.trees} />
      <Rocks clusters={scenery.rocks} />

      {agents.map(agent => {
        const lotName = lotNames.get(agent.lotId) ?? agent.lotId
        if (agent.kind === 'cow') {
          return (
            <group key={agent.id}>
              <Cow cow={agent} alert={agent.outside}>
                {agent.outside && <CowLabel cowName={agent.name} lotName={lotName} variant="alert" />}
                {!agent.outside && showNames && <CowLabel cowName={agent.name} lotName={lotName} variant="name" />}
              </Cow>
              <AgentRing agent={agent} reduceMotion={reduceMotion} />
            </group>
          )
        }
        return (
          <group key={agent.id}>
            {agent.kind === 'person' ? <Person person={agent} /> : <ObjectBeacon agent={agent} />}
            <AgentRing agent={agent} reduceMotion={reduceMotion} />
            <DetectionLabel agent={agent} lotName={lotName} />
          </group>
        )
      })}

      <OrbitControls
        makeDefault
        enableDamping
        dampingFactor={0.08}
        minDistance={4}
        maxDistance={130}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2 - 0.1}
        screenSpacePanning={false}
      />
      <CameraRig preset={preset} request={presetRequest} reduceMotion={reduceMotion} />
      <HerdDriver step={step} />
    </Canvas>
  )
}
