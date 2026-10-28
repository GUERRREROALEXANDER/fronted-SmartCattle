import {
  AnimationMixer,
  Box3,
  Color,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  Vector3,
} from 'three'
import type { AnimationClip, Material, Object3D, SkinnedMesh } from 'three'
import { mergeVertices } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { clone as cloneSkinned } from 'three/examples/jsm/utils/SkeletonUtils.js'
import type { CowCoat } from '../../simulation/herdSimulation'
import { ALERT_COLOR } from '../materials'

// Quaternius "Cow" (CC0), see public/models/CREDITS.md.
export const COW_MODEL_URL = `${import.meta.env.BASE_URL}models/cow.glb`

/** Nose-to-tail length in metres; the model's proportions give ~1.4 m at the withers. */
const TARGET_LENGTH = 2.45
const FEET = ['FrontLowerLeg.L_end', 'FrontLowerLeg.R_end', 'BackLowerLeg.L_end', 'BackLowerLeg.R_end']

export interface CowTemplate {
  scene: Object3D
  animations: AnimationClip[]
  scale: number
  offset: Vector3
  height: number
  /** Ground speed of the walk clip at timeScale 1, in m/s. */
  naturalSpeed: number
  bounds: Box3
}

const templates = new WeakMap<Object3D, CowTemplate>()

function skinnedMeshes(root: Object3D) {
  const meshes: SkinnedMesh[] = []
  root.traverse(object => {
    if ((object as SkinnedMesh).isSkinnedMesh) meshes.push(object as SkinnedMesh)
  })
  return meshes
}

/** Smooths the faceted normals once and measures scale, ground offset and walk speed. */
export function prepareCowTemplate(gltf: { scene: Object3D; animations: AnimationClip[] }): CowTemplate {
  const known = templates.get(gltf.scene)
  if (known) return known

  const meshes = skinnedMeshes(gltf.scene)
  for (const mesh of meshes) {
    const part = (mesh.material as Material).name
    mesh.userData.part = part
    const original = mesh.geometry
    original.deleteAttribute('normal')
    const smooth = mergeVertices(original, 1e-6)
    smooth.computeVertexNormals()
    original.dispose()
    mesh.geometry = smooth
  }
  const main = meshes.find(mesh => mesh.userData.part === 'Main') ?? meshes[0]
  main.geometry.computeBoundingBox()
  const bounds = main.geometry.boundingBox?.clone() ?? new Box3()

  gltf.scene.updateMatrixWorld(true)
  const box = new Box3().setFromObject(gltf.scene, true)
  const size = box.getSize(new Vector3())
  const scale = TARGET_LENGTH / Math.max(size.x, size.z)
  const center = box.getCenter(new Vector3())
  const offset = new Vector3(-center.x * scale, -box.min.y * scale, -center.z * scale)

  // Measure the walk's natural ground speed from one hoof's sweep (stance ~62% of the cycle).
  let naturalSpeed = 0.9
  const walk = gltf.animations.find(clip => clip.name === 'Walk')
  if (walk) {
    const probe = cloneSkinned(gltf.scene)
    const mixer = new AnimationMixer(probe)
    mixer.clipAction(walk).play()
    const foot = probe.getObjectByName(FEET[0])
    const point = new Vector3()
    let zMin = Number.POSITIVE_INFINITY
    let zMax = Number.NEGATIVE_INFINITY
    for (let step = 0; step < 40 && foot; step += 1) {
      mixer.setTime((step / 40) * walk.duration)
      probe.updateMatrixWorld(true)
      foot.getWorldPosition(point)
      zMin = Math.min(zMin, point.z)
      zMax = Math.max(zMax, point.z)
    }
    mixer.stopAllAction()
    mixer.uncacheRoot(probe)
    if (zMax > zMin) naturalSpeed = ((zMax - zMin) * scale) / (0.62 * walk.duration)
  }

  const template: CowTemplate = {
    scene: gltf.scene,
    animations: gltf.animations,
    scale,
    offset,
    height: size.y * scale,
    naturalSpeed,
    bounds,
  }
  templates.set(gltf.scene, template)
  return template
}

// ---------- coat shader: procedural markings in rest-pose space, so they ride with the skin ----------

const NOISE_GLSL = /* glsl */ `
  varying vec3 vRest;
  uniform vec3 uMin;
  uniform vec3 uSize;
  uniform vec3 uBase;
  uniform vec3 uSpot;
  uniform vec3 uShade;
  uniform vec3 uSeed;
  uniform float uSpotAmount;
  uniform float uNeckShade;
  uniform float uLegShade;
  uniform float uLift;
  uniform float uRough;
  uniform float uAlert;
  uniform float uPulse;
  uniform vec3 uAlertColor;
  float hash3(vec3 p) {
    p = fract(p * 0.3183099 + vec3(0.71, 0.113, 0.419));
    p *= 17.0;
    return fract(p.x * p.y * p.z * (p.x + p.y + p.z));
  }
  float vnoise(vec3 x) {
    vec3 i = floor(x);
    vec3 f = fract(x);
    f = f * f * (3.0 - 2.0 * f);
    return mix(mix(mix(hash3(i), hash3(i + vec3(1,0,0)), f.x),
                   mix(hash3(i + vec3(0,1,0)), hash3(i + vec3(1,1,0)), f.x), f.y),
               mix(mix(hash3(i + vec3(0,0,1)), hash3(i + vec3(1,0,1)), f.x),
                   mix(hash3(i + vec3(0,1,1)), hash3(i + vec3(1,1,1)), f.x), f.y), f.z);
  }
  float fbm(vec3 p) {
    float a = 0.5, s = 0.0;
    for (int i = 0; i < 4; i++) { s += a * vnoise(p); p = p * 2.03 + 7.1; a *= 0.5; }
    return s;
  }
  float gSpot;
`

interface CoatLook {
  base: Color
  spot: Color
  shade: Color
  spotAmount: number
  neckShade: number
  legShade: number
  lightLift: number
  roughness: number
  sheen: number
  muzzle: string
}

// Colombian herd: Holstein, criollo red-brown, black Brangus and grey-white Brahman (cebú).
const LOOKS: Record<CowCoat, CoatLook> = {
  holstein: {
    base: new Color(0.8, 0.78, 0.74), spot: new Color(0.016, 0.015, 0.015), shade: new Color(0.6, 0.58, 0.55),
    spotAmount: 1, neckShade: 0, legShade: 0, lightLift: 1, roughness: 0.74, sheen: 0.45, muzzle: '#c59a92',
  },
  brown: {
    base: new Color(0.3, 0.11, 0.045), spot: new Color(0.16, 0.06, 0.025), shade: new Color(0.12, 0.05, 0.025),
    spotAmount: 0, neckShade: 0.35, legShade: 0.55, lightLift: 1.3, roughness: 0.66, sheen: 0.5, muzzle: '#5a3a30',
  },
  black: {
    base: new Color(0.026, 0.024, 0.022), spot: new Color(0.01, 0.01, 0.01), shade: new Color(0.01, 0.01, 0.01),
    spotAmount: 0, neckShade: 0, legShade: 0, lightLift: 1, roughness: 0.52, sheen: 0.7, muzzle: '#2a2421',
  },
  cream: {
    base: new Color(0.74, 0.71, 0.65), spot: new Color(0.5, 0.48, 0.46), shade: new Color(0.36, 0.35, 0.35),
    spotAmount: 0, neckShade: 0.75, legShade: 0.2, lightLift: 1.04, roughness: 0.7, sheen: 0.45, muzzle: '#4a3f3b',
  },
}

/** Shared by every alert material, so one write per frame pulses all of them. */
export const alertPulse = { value: 1 }

const materialCache = new Map<string, Material>()

function coatMaterial(coat: CowCoat, variant: number, alert: boolean, light: boolean, bounds: Box3) {
  const look = LOOKS[coat]
  const material = new MeshPhysicalMaterial({
    color: 0xffffff,
    roughness: look.roughness,
    metalness: 0,
    sheen: look.sheen,
    sheenRoughness: 0.55,
    sheenColor: new Color(0.55, 0.55, 0.55),
  })
  const uniforms = {
    uMin: { value: bounds.min.clone() },
    uSize: { value: bounds.getSize(new Vector3()) },
    uBase: { value: look.base },
    uSpot: { value: look.spot },
    uShade: { value: look.shade },
    uSeed: { value: new Vector3(variant * 3.7, variant * 1.9, variant * 5.3) },
    uSpotAmount: { value: look.spotAmount },
    uNeckShade: { value: look.neckShade },
    uLegShade: { value: look.legShade },
    uLift: { value: light ? look.lightLift : 1 },
    uRough: { value: look.roughness },
    uAlert: { value: alert ? 1 : 0 },
    uPulse: alertPulse,
    uAlertColor: { value: ALERT_COLOR },
  }
  material.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, uniforms)
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec3 vRest;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvRest = position;')
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', `#include <common>\n${NOISE_GLSL}`)
      .replace(
        '#include <color_fragment>',
        /* glsl */ `#include <color_fragment>
        // Model axes: x = lateral, y = length (muzzle at -y), z = up. Normalise by body length.
        vec3 q = (vRest - uMin) / uSize.y;
        float h = (vRest.z - uMin.z) / uSize.z;
        float along = (vRest.y - uMin.y) / uSize.y;
        vec3 warp = vec3(fbm(q * 3.0 + 1.7 + uSeed), fbm(q * 3.0 + 9.2), fbm(q * 3.0 + 4.4 + uSeed.zxy));
        float n = fbm(q * vec3(3.2, 2.6, 3.0) + warp * 1.1 + uSeed);
        float spot = smoothstep(0.47, 0.5, n) * smoothstep(0.24, 0.34, h) * uSpotAmount;
        gSpot = spot;
        vec3 coat = mix(uBase, uSpot, spot);
        float neck = (1.0 - smoothstep(0.18, 0.42, along)) * smoothstep(0.35, 0.6, h);
        float legs = 1.0 - smoothstep(0.12, 0.3, h);
        coat = mix(coat, uShade, clamp(neck * uNeckShade + legs * uLegShade, 0.0, 1.0));
        coat *= 0.88 + 0.24 * fbm(q * 5.0 + uSeed * 0.3);
        float hair = 0.93 + 0.07 * vnoise(q * 140.0);
        coat = mix(coat * uLift, vec3(0.75, 0.08, 0.06), uAlert * 0.4);
        diffuseColor.rgb = coat * hair;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        '#include <roughnessmap_fragment>\nroughnessFactor = mix(uRough + 0.06, uRough - 0.12, gSpot);',
      )
      .replace(
        '#include <emissivemap_fragment>',
        /* glsl */ `#include <emissivemap_fragment>
        float rim = pow(1.0 - clamp(dot(normal, normalize(vViewPosition)), 0.0, 1.0), 2.0);
        totalEmissiveRadiance += uAlertColor * uAlert * (0.18 + rim * 1.8) * (0.55 + 0.45 * uPulse);`,
      )
  }
  material.customProgramCacheKey = () => 'cow-coat'
  return material
}

function partMaterial(part: string, coat: CowCoat) {
  switch (part) {
    case 'Muzzle': return new MeshStandardMaterial({ color: LOOKS[coat].muzzle, roughness: 0.42 })
    case 'Hooves': return new MeshStandardMaterial({ color: '#24201d', roughness: 0.55 })
    case 'Eye_Black': return new MeshPhysicalMaterial({ color: '#050505', roughness: 0.05, clearcoat: 1 })
    case 'Eye_White': return new MeshStandardMaterial({ color: '#d8d2c8', roughness: 0.3 })
    case 'Horns': return new MeshStandardMaterial({ color: '#d8cba8', roughness: 0.5 })
    default: return null
  }
}

/** Cached material for one skinned part of the cow. */
export function cowMaterial(part: string, coat: CowCoat, variant: number, alert: boolean, bounds: Box3) {
  const coatPart = part === 'Main' || part === 'Main_Light'
  const key = coatPart ? `${part}:${coat}:${variant}:${alert}` : `${part}:${coat}`
  let material = materialCache.get(key)
  if (!material) {
    material = coatPart
      ? coatMaterial(coat, variant, alert, part === 'Main_Light', bounds)
      : partMaterial(part, coat) ?? new MeshStandardMaterial({ color: '#888888' })
    materialCache.set(key, material)
  }
  return material
}
