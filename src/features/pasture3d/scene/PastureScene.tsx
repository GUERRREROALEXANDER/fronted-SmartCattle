import { useMemo } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { OrbitControls } from '@react-three/drei'
import type { FarmPlan } from '../../../mocks/mockFarmPlan'
import { Cow } from '../kit/animals/Cow'
import { ZoneFence } from '../kit/fences/ZoneFence'
import { palette } from '../kit/materials'
import { Rocks } from '../kit/nature/Rocks'
import { Tree } from '../kit/nature/Tree'
import { Person } from '../kit/people/Person'
import { Barn } from '../kit/structures/Barn'
import { CameraPole } from '../kit/structures/CameraPole'
import { WaterTrough } from '../kit/structures/WaterTrough'
import { Ground } from '../kit/terrain/Ground'
import { Track } from '../kit/terrain/Track'
import type { ZoneSummary } from '../simulation/herdSimulation'
import type { HerdSimulationController } from '../simulation/useHerdSimulation'
import { CameraRig } from './CameraRig'
import type { CameraPreset } from './cameraPresets'
import { CowLabel } from './CowLabel'
import { BARN_POSITION, buildCameraPoles, buildScenery, TROUGH_POSITION } from './scenery'

export interface PastureSceneProps {
  plan: FarmPlan
  herd: HerdSimulationController
  preset: CameraPreset
  presetRequest: number
  showNames: boolean
  reduceMotion: boolean
}

function HerdDriver({ tick }: { tick: (delta: number) => void }) {
  useFrame((_, delta) => tick(delta))
  return null
}

export function PastureScene({ plan, herd, preset, presetRequest, showNames, reduceMotion }: PastureSceneProps) {
  const { simulation, zones, escapedCowIds, paused, tick } = herd
  const scenery = useMemo(() => buildScenery(simulation.lots, simulation.track), [simulation])
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
      dpr={[1, 2]}
      shadows="percentage"
      camera={{ position: preset.position, fov: 42, near: 0.5, far: 420 }}
      gl={{ antialias: true }}
    >
      <color attach="background" args={[palette.surface]} />
      <fog attach="fog" args={[palette.surface, 85, 190]} />
      <hemisphereLight args={[palette.surfaceRaised, palette.earth, 1.35]} />
      <directionalLight
        position={[34, 52, 22]}
        intensity={2.1}
        color={palette.surfaceRaised}
        castShadow
        shadow-mapSize={[1024, 1024]}
        shadow-bias={-0.0004}
        shadow-normalBias={0.04}
        shadow-camera-left={-56}
        shadow-camera-right={56}
        shadow-camera-top={44}
        shadow-camera-bottom={-44}
        shadow-camera-near={1}
        shadow-camera-far={150}
      />

      <group position={[0, 0.07, 0]}>
        <Ground size={180} segments={40} />
      </group>
      <Track points={simulation.track} width={1.8} />

      {simulation.lots.map(lot => (
        <ZoneFence key={lot.id} lot={lot} breached={zonesById.get(lot.id)?.breached ?? false} />
      ))}

      <Barn position={[BARN_POSITION.x, 0, BARN_POSITION.z]} />
      <WaterTrough position={[TROUGH_POSITION.x, 0, TROUGH_POSITION.z]} heading={Math.PI / 2} />
      {cameraPoles.map(pole => (
        <CameraPole key={pole.id} position={pole.position} heading={pole.heading} />
      ))}
      {scenery.trees.map((tree, index) => (
        <Tree key={index} {...tree} />
      ))}
      {scenery.rocks.map((rock, index) => (
        <Rocks key={index} position={rock.position} seed={rock.seed} count={rock.count} />
      ))}

      {simulation.cows.map(cow => {
        const escaped = escapedCowIds.has(cow.id)
        const lotName = lotNames.get(cow.lotId) ?? cow.lotId
        return (
          <Cow key={cow.id} cow={cow} paused={paused}>
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
        minDistance={7}
        maxDistance={130}
        minPolarAngle={0.15}
        maxPolarAngle={Math.PI / 2 - 0.14}
        screenSpacePanning={false}
      />
      <CameraRig preset={preset} request={presetRequest} reduceMotion={reduceMotion} />
      <HerdDriver tick={tick} />
    </Canvas>
  )
}
