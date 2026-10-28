import { getMaterials } from '../materials'
import { heightAt } from '../terrain/heightfield'

export interface WaterTroughProps {
  position: [number, number, number]
  heading?: number
}

const L = 2.6
const W = 0.9
const H = 0.62
const T = 0.09

/** Cast-concrete trough with a float-valve box and supply pipe. */
export function WaterTrough({ position, heading = 0 }: WaterTroughProps) {
  const materials = getMaterials().structure
  const ground = heightAt(position[0], position[2])
  const walls: [number, number, number, number, number, number][] = [
    [L, T, W, 0, T / 2, 0],
    [L, H, T, 0, H / 2, W / 2 - T / 2],
    [L, H, T, 0, H / 2, -W / 2 + T / 2],
    [T, H, W, L / 2 - T / 2, H / 2, 0],
    [T, H, W, -L / 2 + T / 2, H / 2, 0],
  ]
  return (
    <group position={[position[0], ground - 0.05, position[2]]} rotation={[0, -heading, 0]}>
      {walls.map(([w, h, d, x, y, z], index) => (
        <mesh key={index} material={materials.concrete} position={[x, y, z]} castShadow receiveShadow>
          <boxGeometry args={[w, h, d]} />
        </mesh>
      ))}
      <mesh material={materials.water} position={[0, H - 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]} receiveShadow>
        <planeGeometry args={[L - T * 2, W - T * 2]} />
      </mesh>
      <mesh material={materials.galvanized} position={[L / 2 - 0.35, H + 0.12, 0]} castShadow>
        <boxGeometry args={[0.5, 0.22, W + 0.02]} />
      </mesh>
      <mesh material={materials.galvanized} position={[L / 2 + 0.05, 0.3, 0.25]} castShadow>
        <cylinderGeometry args={[0.03, 0.03, 0.75, 10]} />
      </mesh>
    </group>
  )
}
