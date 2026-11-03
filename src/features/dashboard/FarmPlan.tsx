import { useEffect, useId, useLayoutEffect, useRef } from 'react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import { ConnectionChip, GlassCard } from '../../components/ui'
import type { HerdAgent } from '../../live/herdMotion'
import { unitHash } from '../../live/herdTracker'
import type { LiveConnection } from '../../live/liveState'
import { PulseRing } from '../../motion'
import type { FarmPlan as FarmPlanData, PlanCamera, PlanPoint } from '../../services'
import type { Alert, Camera, CameraStatus, Severity } from '../../types/domain'
import { CowFigure, PersonFigure } from './PlanMarkers'
import styles from './FarmPlan.module.css'

interface FarmPlanProps {
  plan: FarmPlanData
  /** Live agents in plan units; positions change every frame through `step`. */
  agents: readonly HerdAgent[]
  step: (delta: number) => void
  reduceMotion: boolean
  connection: LiveConnection
  cameras: Camera[] | null
  /** Open and acknowledged alerts. */
  alerts: readonly Alert[]
  /** The server is offline: camera states are the last known ones and must not read as live. */
  stale?: boolean
  /** Cameras that deliver a picture; online cameras without one say "sin video". */
  withVideo?: ReadonlySet<string>
  className?: string
  /** Entrance delay of the card, in seconds. */
  delay?: number
}

const statusLabel: Record<CameraStatus, string> = {
  online: 'En línea', connecting: 'Conectando', offline: 'Sin conexión', error: 'Con error',
}

type LotState = Severity | 'breached'

/** Smoothed on-screen pose of one walker; the simulation stays the source of truth. */
interface Pose {
  x: number
  y: number
  angle: number
  speed: number
  stride: number
}

interface MarkerNodes {
  root: SVGGElement
  rig: SVGGElement | null
  head: SVGGElement | null
}

const points = (boundary: readonly PlanPoint[]) => boundary.map(({ x, y }) => `${x},${y}`).join(' ')
const positionTransform = ({ x, y }: PlanPoint) => `translate(${x} ${y})`
const toDegrees = (radians: number) => radians * 180 / Math.PI
const shortestTurn = (delta: number) => Math.atan2(Math.sin(delta), Math.cos(delta))

/** Per-animal gait so the herd never moves in lockstep; derived from the id, stable across renders. */
function gaitFor(id: string) {
  const unit = (seed: number) => unitHash(id, seed)
  return {
    cadence: 7 + unit(1) * 3.5,
    sway: 2.5 + unit(2) * 2.5,
    grazeRate: 1.4 + unit(3) * 1.2,
    phase: unit(4) * Math.PI * 2,
  }
}

/** Field-of-view wedge: 60 degrees wide, 74 plan units deep. */
function viewWedge({ position, heading }: PlanCamera): string {
  const radius = 74
  const toRad = (deg: number) => (deg * Math.PI) / 180
  const a = toRad(heading - 30)
  const b = toRad(heading + 30)
  const p1 = { x: position.x + radius * Math.cos(a), y: position.y + radius * Math.sin(a) }
  const p2 = { x: position.x + radius * Math.cos(b), y: position.y + radius * Math.sin(b) }
  return `M ${position.x} ${position.y} L ${p1.x} ${p1.y} A ${radius} ${radius} 0 0 1 ${p2.x} ${p2.y} Z`
}

/** "Vaca #7" → "#7"; a counted animal without a tracker id has no tag. */
const tagOf = (agent: HerdAgent) => agent.name.match(/#\d+$/)?.[0] ?? ''

/** Walker nodes by id; markers carry data attributes so the frame loop never needs per-node refs. */
function collectMarkers(svg: SVGSVGElement | null): Map<string, MarkerNodes> {
  const found = new Map<string, MarkerNodes>()
  svg?.querySelectorAll<SVGGElement>('[data-walker]').forEach(root => {
    found.set(root.dataset.walker ?? '', {
      root,
      rig: root.querySelector<SVGGElement>('[data-rig]'),
      head: root.querySelector<SVGGElement>('[data-head]'),
    })
  })
  return found
}

export function FarmPlan({
  plan, agents, step, reduceMotion, connection, cameras, alerts, stale = false, withVideo, className, delay,
}: FarmPlanProps) {
  const hatchId = `plan-hatch-${useId()}`
  const svgRef = useRef<SVGSVGElement>(null)
  const poses = useRef(new Map<string, Pose>())
  const animated = !reduceMotion
  const cows = agents.filter(agent => agent.kind === 'cow')
  const people = agents.filter(agent => agent.kind !== 'cow')
  const alertByCamera = new Map<string, Severity>()
  for (const alert of alerts) {
    if (alert.status === 'open' && alert.cameraId && !alertByCamera.has(alert.cameraId)) alertByCamera.set(alert.cameraId, alert.severity)
  }
  // An animal outside its zone uses the lindero's breached language (red, hatched outside), the same as on video.
  const outsideCameras = new Set(alerts.filter(alert => alert.status === 'open' && alert.kind === 'cattle_out_of_zone' && alert.cameraId)
    .map(alert => alert.cameraId!))
  const lotState = new Map<string, LotState>(plan.cameras.filter(camera => alertByCamera.has(camera.cameraId))
    .map(camera => [camera.lotId, outsideCameras.has(camera.cameraId) ? 'breached' : alertByCamera.get(camera.cameraId)!]))
  const seenOutside = new Set(cows.filter(cow => cow.outside).map(cow => cow.lotId))
  const cameraById = new Map(cameras?.map(camera => [camera.id, camera]))
  const outsideCows = cows.filter(cow => cow.outside)
  const lotName = (id: string) => plan.lots.find(lot => lot.id === id)?.name ?? 'su lote'

  // The frame loop reads the latest agents without restarting when the list changes.
  const agentsRef = useRef(agents)
  useLayoutEffect(() => { agentsRef.current = agents })

  // One frame loop: advance the live herd, then write positions straight to the SVG (no React render per frame).
  useEffect(() => {
    let animationFrame = 0
    let previous = performance.now()
    const gaits = new Map<string, ReturnType<typeof gaitFor>>()
    const gait = (id: string) => {
      let value = gaits.get(id)
      if (!value) gaits.set(id, value = gaitFor(id))
      return value
    }

    const advance = (id: string, position: PlanPoint, heading: number, dt: number) => {
      let pose = poses.current.get(id)
      if (!pose) {
        pose = { x: position.x, y: position.y, angle: heading, speed: 0, stride: 0 }
        poses.current.set(id, pose)
      }
      // Exponential follow: smooth when the simulation jumps, never lagging more than a few frames.
      const follow = animated ? 1 - Math.exp(-dt * 16) : 1
      const nextX = pose.x + (position.x - pose.x) * follow
      const nextY = pose.y + (position.y - pose.y) * follow
      const velocity = Math.hypot(nextX - pose.x, nextY - pose.y) / Math.max(dt, 0.001)
      pose.speed += (velocity - pose.speed) * (1 - Math.exp(-dt * 6))
      pose.x = nextX
      pose.y = nextY
      pose.angle += shortestTurn(heading - pose.angle) * (animated ? 1 - Math.exp(-dt * 5) : 1)
      return pose
    }

    const draw = (time: number) => {
      const dt = Math.min(0.1, Math.max(0, (time - previous) / 1000))
      previous = time
      const seconds = time / 1000
      step(dt)
      const markers = collectMarkers(svgRef.current)
      for (const agent of agentsRef.current) {
        const nodes = markers.get(agent.id)
        if (!nodes) continue
        const pose = advance(agent.id, { x: agent.position.x, y: agent.position.z }, agent.heading, dt)
        // Appear and leave at 90 % size with a fade, never from nothing.
        nodes.root.setAttribute('opacity', agent.presence.toFixed(3))
        const presence = 0.9 + 0.1 * agent.presence
        if (agent.kind === 'cow') {
          const { cadence, sway: swayAmount, grazeRate, phase } = gait(agent.id)
          const walking = Math.min(1, pose.speed / 8)
          pose.stride += dt * cadence * (0.5 + walking)
          const sway = Math.sin(pose.stride) * swayAmount * walking
          const graze = 1 - walking
          const bob = Math.sin(seconds * grazeRate + phase) * graze
          nodes.root.setAttribute('transform', `translate(${pose.x.toFixed(2)} ${pose.y.toFixed(2)}) scale(${presence.toFixed(3)})`)
          nodes.rig?.setAttribute('transform',
            `rotate(${(toDegrees(pose.angle) + sway).toFixed(2)}) scale(${(1 + bob * 0.02).toFixed(4)} ${(1 - bob * 0.015).toFixed(4)})`)
          // Grazing lowers the head, which reads as a shorter neck from above.
          nodes.head?.setAttribute('transform', `translate(${(-graze * (1.2 + bob * 0.8)).toFixed(2)} 0)`)
        } else {
          pose.stride += dt * 9 * Math.min(1, pose.speed / 6)
          nodes.root.setAttribute('transform', `translate(${pose.x.toFixed(2)} ${pose.y.toFixed(2)}) scale(${presence.toFixed(3)})`)
          nodes.rig?.setAttribute('transform', `rotate(${(toDegrees(pose.angle) + Math.sin(pose.stride) * 4).toFixed(2)})`)
        }
      }
      animationFrame = requestAnimationFrame(draw)
    }
    animationFrame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animationFrame)
  }, [animated, step])

  // Freshly mounted markers have no transform yet; place them before the browser paints.
  useLayoutEffect(() => {
    const markers = collectMarkers(svgRef.current)
    for (const agent of agents) {
      const nodes = markers.get(agent.id)
      if (!nodes || (animated && nodes.root.hasAttribute('transform'))) continue
      const pose = poses.current.get(agent.id)
      nodes.root.setAttribute('transform', positionTransform(pose ?? { x: agent.position.x, y: agent.position.z }))
      nodes.rig?.setAttribute('transform', `rotate(${toDegrees(pose?.angle ?? agent.heading)})`)
    }
  })

  return <GlassCard as="section" padding="none" tone="strong" delay={delay}
    className={[styles.section, className].filter(Boolean).join(' ')} aria-labelledby="farm-plan-title">
    <div className={styles.heading}>
      <div className={styles.headingText}>
        <div className={styles.titleRow}>
          <h2 id="farm-plan-title" className={styles.title}>Monitoreo en vivo</h2>
          <ConnectionChip connection={connection} />
        </div>
        <p className={styles.note}>
          Cada vaca y cada persona está donde la ubicó la cámara de su lote
          {seenOutside.size > 0 && <> · <strong className={styles.critical}>fuera de zona en {[...seenOutside].map(lotName).join(', ')}</strong></>}
        </p>
      </div>
    </div>

    <div className={styles.subheading}>
      <ul className={styles.markerLegend} aria-label="Leyenda del monitoreo">
        <li><span className={`${styles.legendMarker} ${styles.safeMarker}`} aria-hidden="true" />Ganado dentro</li>
        <li>
          <PulseRing active={outsideCows.length > 0 && animated} className={styles.legendRing}>
            <span className={`${styles.legendMarker} ${styles.outsideMarker}`} aria-hidden="true" />
          </PulseRing>
          Fuera del perímetro
        </li>
        <li><span className={`${styles.legendMarker} ${styles.personMarker}`} aria-hidden="true" />Persona</li>
      </ul>
    </div>
    <p className="visually-hidden" aria-live="polite">
      {outsideCows.length === 0 ? 'Todo el ganado está dentro del perímetro.' : outsideCows.map(cow => `${cow.name} fuera del perímetro ${lotName(cow.lotId)}.`).join(' ')}
    </p>

    <div className={styles.canvas}>
      <svg ref={svgRef} viewBox={`0 0 ${plan.width} ${plan.height}`} role="img"
        aria-label={`Plano en vivo con ${cows.length - outsideCows.length} de ${cows.length} vacas dentro del perímetro, ${outsideCows.length} fuera y ${people.filter(person => person.kind === 'person').length} personas detectadas`}>
        <defs>
          {(['warning', 'critical'] as const).map(tone =>
            <pattern key={tone} id={`${hatchId}-${tone}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <path d="M 0 0 V 8" className={`${styles.hatchLine} ${styles[tone]}`} />
            </pattern>)}
          {/* The breached hatch drifts so an exited zone reads as active, not decorative. */}
          <pattern id={`${hatchId}-alarm`} width="9" height="9" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
            <path d="M 0 0 V 9" className={`${styles.hatchLine} ${styles.alarmHatch}`} />
            {animated && <animateTransform attributeName="patternTransform" type="translate" from="0 0" to="9 0"
              dur="0.9s" repeatCount="indefinite" additive="sum" />}
          </pattern>
          <linearGradient id={`${hatchId}-lot`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" className={styles.lotStopTop} />
            <stop offset="1" className={styles.lotStopBottom} />
          </linearGradient>
          <linearGradient id={`${hatchId}-lot-alarm`} x1="0" y1="0" x2="0.35" y2="1">
            <stop offset="0" className={styles.lotStopTop} />
            <stop offset="1" className={styles.lotStopAlarm} />
          </linearGradient>
          <radialGradient id={`${hatchId}-shadow`}>
            <stop offset="0" className={styles.shadowStopIn} />
            <stop offset="1" className={styles.shadowStopOut} />
          </radialGradient>
          <linearGradient id={`${hatchId}-sheen`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" className={styles.sheenTop} />
            <stop offset="0.5" className={styles.sheenMid} />
            <stop offset="1" className={styles.sheenBottom} />
          </linearGradient>
        </defs>

        <g className={styles.terrain}>
          {plan.contours.map(path => <path key={path} d={path} />)}
        </g>
        <polyline className={styles.trackBed} points={points(plan.track)} />
        <polyline className={styles.track} points={points(plan.track)} />

        <g className={styles.lots}>
          {plan.lots.map(lot => {
            const state = seenOutside.has(lot.id) ? 'breached' : lotState.get(lot.id)
            const ring = `${hatchId}-ring-${lot.id}`
            return <g key={lot.id} className={state ? styles[state] : undefined}>
              {state === 'breached' && <>
                <clipPath id={ring}>
                  <path fillRule="evenodd" d={`M0 0 H${plan.width} V${plan.height} H0 Z M${lot.boundary.map(({ x, y }) => `${x} ${y}`).join(' L')} Z`} />
                </clipPath>
                <polygon className={styles.outsideRing} points={points(lot.boundary)} clipPath={`url(#${ring})`} stroke={`url(#${hatchId}-alarm)`} />
              </>}
              <polygon className={styles.lot} points={points(lot.boundary)}
                fill={`url(#${hatchId}-${state === 'breached' ? 'lot-alarm' : 'lot'})`} />
              <polygon className={styles.lotInner} points={points(lot.boundary)} />
              {(state === 'warning' || state === 'critical') && <polygon points={points(lot.boundary)} fill={`url(#${hatchId}-${state})`} className={styles.lotHatch} />}
              {state === 'breached' && <polygon points={points(lot.boundary)} fill={`url(#${hatchId}-alarm)`} className={styles.breachHatch} />}
              <polygon className={styles.lindero} points={points(lot.boundary)} vectorEffect="non-scaling-stroke" />
              {lot.boundary.map(({ x, y }) => <circle key={`${x}-${y}`} className={styles.vertex} cx={x} cy={y} r="3.5" />)}
              <text className={styles.lotLabel} x={lot.labelAt.x} y={lot.labelAt.y}>{lot.name}</text>
            </g>
          })}
        </g>

        {plan.cameras.map(point => {
          const camera = cameraById.get(point.cameraId)
          const status = stale ? 'stale' : camera?.status ?? 'offline'
          const severity = outsideCameras.has(point.cameraId) ? 'critical' : alertByCamera.get(point.cameraId)
          return <g key={point.cameraId} className={`${styles.point} ${styles[status]}`}>
            <path className={styles.wedge} d={viewWedge(point)} />
            {severity && <circle className={`${styles.pulse} ${styles[severity]}`} cx={point.position.x} cy={point.position.y} r="10" />}
            <circle className={styles.pointRing} cx={point.position.x} cy={point.position.y} r="8" />
            <circle className={styles.pointDot} cx={point.position.x} cy={point.position.y} r="3.5" />
            <text className={styles.pointLabel} x={point.position.x + (point.label.side === 'left' ? -14 : 14)} y={point.position.y + point.label.dy}
              textAnchor={point.label.side === 'left' ? 'end' : 'start'}>
              {camera?.name ?? point.cameraId}
            </text>
          </g>
        })}

        <g className={styles.people}>
          {people.map(person => <g key={person.id} data-walker={person.id}>
            {/* Inner group: CSS scales the marker while the outer transform carries the position. */}
            <g className={styles.marker}>
              <PersonFigure shadowId={`${hatchId}-shadow`} />
              <text className={styles.personLabel} x="0" y="27" textAnchor="middle">
                {person.kind === 'person' ? 'Persona' : person.name}
              </text>
            </g>
          </g>)}
        </g>

        <g className={styles.herd}>
          {/* Cows outside are drawn last so their red marker and label are never covered. */}
          {[...cows].sort((a, b) => Number(a.outside) - Number(b.outside)).map(cow => <g key={cow.id}
            data-walker={cow.id}
            className={`${styles.cow} ${cow.outside ? styles.cowOutside : ''}`}>
            <g className={styles.marker}>
              {cow.outside && <circle className={styles.cowPulse} r="21" />}
              <CowFigure shadowId={`${hatchId}-shadow`} sheenId={`${hatchId}-sheen`} />
              {tagOf(cow) && <g className={styles.cowTag} transform="translate(0 24)">
                <rect className={styles.cowTagShadow} x="-15" y="-7" width="30" height="15" rx="7.5" />
                <rect className={styles.cowTagBackground} x="-15" y="-8" width="30" height="15" rx="7.5" />
                <text className={styles.cowTagText} x="0" y="3.4" textAnchor="middle">{tagOf(cow)}</text>
              </g>}
              {cow.outside && <g className={styles.outsideLabel}>
                <rect x="-62" y="-47" width="124" height="21" rx="10.5" />
                <text x="0" y="-32.5" textAnchor="middle">Fuera del perímetro</text>
              </g>}
            </g>
          </g>)}
        </g>
      </svg>
    </div>

    {cameras && <ul className={styles.legend} aria-label="Cámaras">
      {plan.cameras.map(point => {
        const camera = cameraById.get(point.cameraId)
        if (!camera) return null
        const severity = outsideCameras.has(camera.id) ? 'critical' : alertByCamera.get(camera.id)
        const dotState = stale ? 'stale' : camera.status
        return <li key={camera.id}>
          <Link className={styles.legendItem} to={`/live?camera=${encodeURIComponent(camera.id)}`}>
            <span className={`${styles.legendDot} ${styles[dotState]}`} aria-hidden="true" />
            <span className={styles.legendText}>
              <span className={styles.legendName}>{camera.name}</span>
              <span className={styles.legendMeta}>
                {camera.location} · {stale ? 'Sin datos actualizados' : statusLabel[camera.status]}{!stale && camera.status === 'online' && withVideo && !withVideo.has(camera.id) ? ' · sin video' : ''}
                {severity && <strong className={styles[severity]}> · {outsideCameras.has(camera.id) ? 'Animal fuera de zona' : 'Con alerta'}</strong>}
              </span>
            </span>
            <ChevronRight className={styles.legendChevron} size={18} strokeWidth={1.75} aria-hidden="true" />
            <span className="visually-hidden">Ver en vivo</span>
          </Link>
        </li>
      })}
    </ul>}
  </GlassCard>
}
