import { useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import { ACESFilmicToneMapping, Color } from 'three'
import type { FarmPlan } from '../../../mocks/mockFarmPlan'
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
import type { ZoneSummary } from '../simulation/herdSimulation'
import type { HerdSimulationController } from '../simulation/useHerdSimulation'
import { CameraRig } from './CameraRig'
import type { CameraPreset } from './cameraPresets'
import { CowLabel } from './CowLabel'
import { BARN_POSITION, buildCameraPoles, buildScenery, PERIMETER, TROUGH_POSITION } from './scenery'

export interface PastureSceneProps {
  plan: FarmPlan
  herd: HerdSimulationController
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

function HerdDriver({ tick }: { tick: (delta: number) => void }) {
  useFrame((_, delta) => tick(delta))
  return null
}

export function PastureScene({ plan, herd, preset, presetRequest, showNames, reduceMotion }: PastureSceneProps) {
  const { simulation, zones, escapedCowIds, paused, tick } = herd
  const road = useMemo(() => extendTrack(simulation.track), [simulation])
  const scenery = useMemo(() => buildScenery(simulation.lots, road), [simulation, road])
  const cameraPoles = useMemo(() => buildCameraPoles(plan), [plan])
  const zonesById = useMemo(
    () => new Map<string, ZoneSummary>(zones.map(zone => [zone.lotId, zone])),
    [zones],
  )
  const lotNames = useMemo(
    () => new Map(simulation.lots.map(lot => [lot.id, lot.name])),
    [simulation],
  )

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

      <Ground lots={simulation.lots} track={road} yards={YARDS} />
      <Track points={road} width={2.6} />
      <Grass lots={simulation.lots} track={road} clearings={CLEARINGS} windy={!reduceMotion} />

      <PerimeterFence halfX={PERIMETER.halfX} halfZ={PERIMETER.halfZ} track={road} />
      {simulation.lots.map(lot => (
        <ZoneFence
          key={lot.id}
          lot={lot}
          track={simulation.track}
          breached={zonesById.get(lot.id)?.breached ?? false}
        />
      ))}

      <Barn position={[BARN_POSITION.x, 0, BARN_POSITION.z]} />
      <WaterTrough position={[TROUGH_POSITION.x, 0, TROUGH_POSITION.z]} heading={Math.PI / 2} />
      {cameraPoles.map(pole => (
        <CameraPole key={pole.id} position={pole.position} heading={pole.heading} />
      ))}
      <Trees trees={scenery.trees} />
      <Rocks clusters={scenery.rocks} />

      {simulation.cows.map(cow => {
        const escaped = escapedCowIds.has(cow.id)
        const lotName = lotNames.get(cow.lotId) ?? cow.lotId
        return (
          <Cow key={cow.id} cow={cow} alert={escaped} paused={paused}>
            {escaped && <CowLabel cowName={cow.name} lotName={lotName} variant="alert" />}
            {!escaped && showNames && <CowLabel cowName={cow.name} lotName={lotName} variant="name" />}
          </Cow>
        )
      })}
      {simulation.people.map(person => (
        <Person key={person.id} person={person} paused={paused} />
      ))}

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
      <HerdDriver tick={tick} />
    </Canvas>
  )
}
