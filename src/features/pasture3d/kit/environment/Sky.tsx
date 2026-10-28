import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import {
  BackSide,
  CircleGeometry,
  Color,
  Mesh,
  MeshBasicMaterial,
  PMREMGenerator,
  Scene,
  ShaderMaterial,
  SphereGeometry,
  SRGBColorSpace,
  Vector3,
} from 'three'
import { SUN_DIRECTION } from './sun'

// Linear HDR sky values; the renderer tone maps them like any lit surface.
const ZENITH = new Color(0x3f7fcf).multiplyScalar(1.25)
const HORIZON = new Color(0xd3e3ea).multiplyScalar(1.3)
const SUN = new Color(1, 0.92, 0.78)

function skyMaterial(fogColor: Color) {
  const fogSrgb = fogColor.clone()
  fogSrgb.getRGB(fogSrgb, SRGBColorSpace)
  return new ShaderMaterial({
    side: BackSide,
    depthWrite: false,
    fog: false,
    uniforms: {
      uHorizon: { value: HORIZON },
      uZenith: { value: ZENITH },
      uSunDir: { value: SUN_DIRECTION },
      uSun: { value: SUN },
      uFog: { value: new Vector3(fogSrgb.r, fogSrgb.g, fogSrgb.b) },
    },
    vertexShader: /* glsl */ `
      varying vec3 vDir;
      void main() {
        vDir = normalize(position);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uHorizon;
      uniform vec3 uZenith;
      uniform vec3 uSunDir;
      uniform vec3 uSun;
      uniform vec3 uFog;
      varying vec3 vDir;
      float hash(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
      float vnoise(vec2 p) {
        vec2 i = floor(p); vec2 f = fract(p); f = f * f * (3.0 - 2.0 * f);
        return mix(mix(hash(i), hash(i + vec2(1, 0)), f.x), mix(hash(i + vec2(0, 1)), hash(i + vec2(1, 1)), f.x), f.y);
      }
      void main() {
        vec3 d = normalize(vDir);
        float t = clamp(d.y, 0.0, 1.0);
        vec3 col = mix(uHorizon, uZenith, pow(smoothstep(0.0, 1.0, t), 0.55));
        // Soft fair-weather clouds on a flat layer.
        vec2 uv = d.xz / max(d.y, 0.06) * 1.4;
        float c = vnoise(uv) * 0.55 + vnoise(uv * 2.3 + 4.0) * 0.3 + vnoise(uv * 5.1 + 9.0) * 0.15;
        c = smoothstep(0.55, 0.8, c) * smoothstep(0.03, 0.25, d.y);
        col = mix(col, vec3(1.45, 1.43, 1.4), c * 0.75);
        float s = max(dot(d, uSunDir), 0.0);
        col += uSun * (pow(s, 900.0) * 3.0 + pow(s, 16.0) * 0.3 + pow(s, 3.0) * 0.08);
        gl_FragColor = vec4(col, 1.0);
        #include <tonemapping_fragment>
        #include <colorspace_fragment>
        // Blend into the scene fog at the horizon so the land has no seam.
        gl_FragColor.rgb = mix(gl_FragColor.rgb, uFog, 1.0 - smoothstep(-0.02, 0.16, d.y));
      }`,
  })
}

export interface SkyProps {
  fogColor: Color
  environmentIntensity?: number
}

/** Sky dome that follows the camera, plus a matching PMREM environment for image-based light. */
export function Sky({ fogColor, environmentIntensity = 0.6 }: SkyProps) {
  const gl = useThree(state => state.gl)
  const scene = useThree(state => state.scene)
  const domeRef = useRef<Mesh>(null)
  const geometry = useMemo(() => new SphereGeometry(320, 48, 24), [])
  const material = useMemo(() => skyMaterial(fogColor), [fogColor])

  useEffect(() => {
    const envScene = new Scene()
    envScene.add(new Mesh(geometry, material))
    const groundGeometry = new CircleGeometry(300, 32).rotateX(-Math.PI / 2)
    const groundMaterial = new MeshBasicMaterial({ color: new Color(0x4f7a32).multiplyScalar(0.5) })
    const envGround = new Mesh(groundGeometry, groundMaterial)
    envGround.position.y = -2
    envScene.add(envGround)
    const pmrem = new PMREMGenerator(gl)
    const target = pmrem.fromScene(envScene, 0.02, 0.1, 800)
    pmrem.dispose()
    groundGeometry.dispose()
    groundMaterial.dispose()
    Object.assign(scene, { environment: target.texture, environmentIntensity })
    return () => {
      Object.assign(scene, { environment: null })
      target.dispose()
    }
  }, [environmentIntensity, geometry, gl, material, scene])

  useEffect(() => () => {
    geometry.dispose()
    material.dispose()
  }, [geometry, material])

  useFrame(({ camera }) => {
    domeRef.current?.position.copy(camera.position)
  })

  return <mesh ref={domeRef} geometry={geometry} material={material} renderOrder={-10} frustumCulled={false} />
}
