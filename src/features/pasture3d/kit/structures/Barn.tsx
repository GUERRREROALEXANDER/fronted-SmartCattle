import { useEffect, useMemo } from 'react'
import { CylinderGeometry, ExtrudeGeometry, MeshStandardMaterial, Shape } from 'three'
import { getMaterials } from '../materials'
import { heightAt } from '../terrain/heightfield'
import { baleTexture } from '../textures'

export interface BarnProps {
  position: [number, number, number]
}

const LENGTH = 8.4
const WIDTH = 7
const WALL = 3.3
const RIDGE = 5.3
const SLOPE = Math.atan2(RIDGE - WALL, WIDTH / 2)
const SLOPE_LENGTH = Math.hypot(RIDGE - WALL, WIDTH / 2)

function bodyGeometry() {
  const shape = new Shape()
  shape.moveTo(-WIDTH / 2, 0)
  shape.lineTo(WIDTH / 2, 0)
  shape.lineTo(WIDTH / 2, WALL)
  shape.lineTo(0, RIDGE)
  shape.lineTo(-WIDTH / 2, WALL)
  shape.closePath()
  const geometry = new ExtrudeGeometry(shape, { depth: LENGTH, bevelEnabled: false })
  geometry.translate(0, 0, -LENGTH / 2)
  geometry.rotateY(-Math.PI / 2)
  return geometry
}

/** Classic gable barn: board siding, zinc roof, half-open sliding door, lean-to with hay. */
export function Barn({ position }: BarnProps) {
  const materials = getMaterials().structure
  const body = useMemo(() => bodyGeometry(), [])
  const roofMaterial = useMemo(() => {
    const material = materials.zinc.clone()
    if (material.map) {
      const map = material.map.clone()
      map.repeat.set(12, 1)
      material.map = map
      material.bumpMap = map
    }
    return material
  }, [materials.zinc])
  const sidingMaterial = useMemo(() => {
    const material = materials.planks.clone()
    if (material.map) {
      const map = material.map.clone()
      map.repeat.set(0.45, 0.45)
      material.map = map
      material.bumpMap = map
    }
    return material
  }, [materials.planks])
  const bale = useMemo(() => ({
    geometry: new CylinderGeometry(0.62, 0.62, 1.15, 28),
    material: new MeshStandardMaterial({ map: baleTexture(), roughness: 0.95 }),
  }), [])

  useEffect(() => () => {
    body.dispose()
    roofMaterial.map?.dispose()
    roofMaterial.dispose()
    sidingMaterial.map?.dispose()
    sidingMaterial.dispose()
    bale.geometry.dispose()
    bale.material.dispose()
  }, [bale, body, roofMaterial, sidingMaterial])

  const ground = heightAt(position[0], position[2])
  const front = LENGTH / 2

  return (
    <group position={[position[0], ground, position[2]]}>
      <mesh material={materials.concrete} position={[0, -0.25, 0]} castShadow receiveShadow>
        <boxGeometry args={[LENGTH + 0.3, 0.7, WIDTH + 0.3]} />
      </mesh>
      <mesh geometry={body} material={sidingMaterial} position={[0, 0.1, 0]} castShadow receiveShadow />

      {/* Roof: two corrugated panels, ridge cap and fascia trim. */}
      {[-1, 1].map(side => (
        <group key={side}>
          <mesh
            material={roofMaterial}
            position={[0, 0.1 + (WALL + RIDGE) / 2 + 0.06, side * WIDTH / 4]}
            rotation={[side * SLOPE, 0, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[LENGTH + 0.9, 0.05, SLOPE_LENGTH + 0.55]} />
          </mesh>
          <mesh material={materials.trim} position={[0, 0.1 + WALL - 0.05, side * (WIDTH / 2 + 0.03)]} castShadow>
            <boxGeometry args={[LENGTH + 0.1, 0.16, 0.06]} />
          </mesh>
        </group>
      ))}
      <mesh material={materials.galvanized} position={[0, 0.1 + RIDGE + 0.1, 0]} rotation={[Math.PI / 4, 0, 0]} castShadow>
        <boxGeometry args={[LENGTH + 0.9, 0.22, 0.22]} />
      </mesh>

      {/* Front gable: door opening, sliding leaves with X bracing, hayloft hatch. */}
      <group position={[front + 0.1, 0.1, 0]}>
        <mesh material={materials.interior} position={[-0.05, 1.4, 0]}>
          <boxGeometry args={[0.12, 2.8, 2.9]} />
        </mesh>
        {[
          { z: -0.72, open: false },
          { z: 2.15, open: true },
        ].map(({ z, open }) => (
          <group key={z} position={[open ? 0.1 : 0.06, 1.42, z]}>
            <mesh material={materials.darkWood} castShadow receiveShadow>
              <boxGeometry args={[0.07, 2.84, 1.5]} />
            </mesh>
            {[-1, 1].map(diagonal => (
              <mesh key={diagonal} material={materials.trim} position={[0.045, 0, 0]} rotation={[diagonal * Math.atan2(2.6, 1.3), 0, 0]}>
                <boxGeometry args={[0.03, Math.hypot(2.6, 1.3), 0.1]} />
              </mesh>
            ))}
            {[-1.37, 1.37].map(y => (
              <mesh key={y} material={materials.trim} position={[0.045, y, 0]}>
                <boxGeometry args={[0.03, 0.1, 1.5]} />
              </mesh>
            ))}
            {[-0.7, 0.7].map(edge => (
              <mesh key={edge} material={materials.trim} position={[0.045, 0, edge]}>
                <boxGeometry args={[0.03, 2.84, 0.1]} />
              </mesh>
            ))}
          </group>
        ))}
        <mesh material={materials.galvanized} position={[0.16, 2.95, 0.7]}>
          <boxGeometry args={[0.06, 0.08, 4.4]} />
        </mesh>
        <mesh material={materials.darkWood} position={[0.04, 3.85, 0]} castShadow>
          <boxGeometry args={[0.06, 1, 1.2]} />
        </mesh>
        <mesh material={materials.trim} position={[0.08, 3.85, 0]}>
          <boxGeometry args={[0.02, 1.08, 1.28]} />
        </mesh>
      </group>

      {/* Side windows. */}
      {[-1, 1].flatMap(side => [-2, 1.6].map(x => (
        <group key={`${side}:${x}`} position={[x, 2.1, side * (WIDTH / 2 + 0.11)]}>
          <mesh material={materials.trim}>
            <boxGeometry args={[1.05, 0.95, 0.04]} />
          </mesh>
          <mesh material={materials.cameraLens} position={[0, 0, side * 0.02]}>
            <boxGeometry args={[0.85, 0.75, 0.03]} />
          </mesh>
        </group>
      )))}

      {/* Lean-to shed on the north wall, with stacked round bales underneath. */}
      <group position={[0, 0.1, -WIDTH / 2]}>
        <mesh material={roofMaterial} position={[0, 2.55, -1.7]} rotation={[-0.2, 0, 0]} castShadow receiveShadow>
          <boxGeometry args={[LENGTH, 0.05, 3.7]} />
        </mesh>
        {[-LENGTH / 2 + 0.2, 0, LENGTH / 2 - 0.2].map(x => (
          <mesh key={x} material={materials.darkWood} position={[x, 1.1, -3.4]} castShadow>
            <boxGeometry args={[0.16, 2.3, 0.16]} />
          </mesh>
        ))}
        {[[-2.6, -1.7], [-1.3, -1.7], [0, -1.8], [-1.95, -1.75, true]].map(([x, z, top], index) => (
          <mesh
            key={index}
            geometry={bale.geometry}
            material={bale.material}
            position={[x as number, top ? 1.62 : 0.62, z as number]}
            rotation={[Math.PI / 2, 0, 0]}
            castShadow
            receiveShadow
          />
        ))}
      </group>
    </group>
  )
}
