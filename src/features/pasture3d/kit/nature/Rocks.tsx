import { useMemo } from 'react'
import { mulberry32, randomRange } from '../../simulation/rng'
import { rockGeometry } from '../geometries'
import { materials } from '../materials'

export interface RocksProps {
  position?: [number, number, number]
  /** Same seed, same cluster: keeps the scene identical between renders. */
  seed?: number
  count?: number
  spread?: number
}

export function Rocks({ position = [0, 0, 0], seed = 1, count = 3, spread = 0.9 }: RocksProps) {
  const rocks = useMemo(() => {
    const rng = mulberry32(seed)
    return Array.from({ length: Math.max(1, Math.floor(count)) }, (_, index) => {
      const size = index === 0 ? randomRange(rng, 0.45, 0.8) : randomRange(rng, 0.18, 0.45)
      const height = size * randomRange(rng, 0.45, 0.75)
      const angle = rng() * Math.PI * 2
      const distance = index === 0 ? 0 : randomRange(rng, 0.4, 1) * spread
      return {
        position: [Math.cos(angle) * distance, height * 0.35, Math.sin(angle) * distance] as [number, number, number],
        rotation: [rng() * 0.6, rng() * Math.PI * 2, rng() * 0.6] as [number, number, number],
        scale: [size * randomRange(rng, 0.9, 1.3), height, size] as [number, number, number],
        light: rng() < 0.4,
      }
    })
  }, [count, seed, spread])

  return (
    <group position={position}>
      {rocks.map((rock, index) => (
        <mesh
          key={index}
          geometry={rockGeometry}
          material={rock.light ? materials.nature.rockLight : materials.nature.rock}
          position={rock.position}
          rotation={rock.rotation}
          scale={rock.scale}
          castShadow
          receiveShadow
        />
      ))}
    </group>
  )
}
