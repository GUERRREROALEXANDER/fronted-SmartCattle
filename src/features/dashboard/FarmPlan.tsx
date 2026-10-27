import { useEffect, useId, useRef, useState } from 'react'
import { ChevronRight, Gauge, LogOut, Pause, Play } from 'lucide-react'
import { Link } from 'react-router'
import { Button } from '../../components/ui'
import { useZoneAlarm } from '../../lib/alarm'
import type { FarmPlan as FarmPlanData, PlanCamera, PlanPoint } from '../../services'
import type { Camera, CameraStatus, FarmEvent, Severity } from '../../types/domain'
import type { LiveCowSnapshot } from './liveHerd'
import type { LiveHerdController } from './useLiveHerd'
import styles from './FarmPlan.module.css'

interface FarmPlanProps {
  plan: FarmPlanData
  live: LiveHerdController
  cameras: Camera[] | null
  alerts: FarmEvent[]
  /** The server is offline: camera states are the last known ones and must not read as live. */
  stale?: boolean
  /** Cameras that deliver a picture; online cameras without one say "sin video". */
  withVideo?: ReadonlySet<string>
}

const statusLabel: Record<CameraStatus, string> = {
  online: 'En línea', connecting: 'Conectando', offline: 'Sin conexión', error: 'Con error',
}

type LotState = Severity | 'breached'

const points = (boundary: readonly PlanPoint[]) => boundary.map(({ x, y }) => `${x},${y}`).join(' ')
const positionTransform = ({ x, y }: PlanPoint) => `translate(${x} ${y})`

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

function CowAlarm({ cow }: { cow: LiveCowSnapshot }) {
  useZoneAlarm(`plan:${cow.id}`, cow.outside, `Vaca #${cow.tag} salió del perímetro ${cow.zoneName}`)
  return null
}

export function FarmPlan({ plan, live, cameras, alerts, stale = false, withVideo }: FarmPlanProps) {
  const hatchId = `plan-hatch-${useId()}`
  const [actionMessage, setActionMessage] = useState('')
  const cowNodes = useRef(new Map<string, SVGGElement>())
  const personNodes = useRef(new Map<string, SVGGElement>())
  const alertByCamera = new Map<string, Severity>()
  for (const alert of alerts) if (!alertByCamera.has(alert.cameraId)) alertByCamera.set(alert.cameraId, alert.severity)
  // An animal outside its zone uses the lindero's breached language (red, hatched outside), the same as on video.
  const outsideCameras = new Set(alerts.filter(alert => alert.kind === 'cattle_out_of_zone').map(alert => alert.cameraId))
  const lotState = new Map<string, LotState>(plan.cameras.filter(camera => alertByCamera.has(camera.cameraId))
    .map(camera => [camera.lotId, outsideCameras.has(camera.cameraId) ? 'breached' : alertByCamera.get(camera.cameraId)!]))
  const simulatedBreaches = new Set(live.snapshot.zones.filter(zone => zone.outside > 0).map(zone => zone.id))
  const cameraById = new Map(cameras?.map(camera => [camera.id, camera]))
  const outsideCows = live.snapshot.cows.filter(cow => cow.outside)

  useEffect(() => {
    if (live.reduceMotion) return
    let animationFrame = 0
    const draw = () => {
      for (const cow of live.simulation.cows) {
        cowNodes.current.get(cow.id)?.setAttribute('transform', positionTransform(cow.position))
      }
      for (const person of live.simulation.people) {
        personNodes.current.get(person.id)?.setAttribute('transform', positionTransform(person.position))
      }
      animationFrame = requestAnimationFrame(draw)
    }
    animationFrame = requestAnimationFrame(draw)
    return () => cancelAnimationFrame(animationFrame)
  }, [live.reduceMotion, live.simulation])

  const simulateExit = () => {
    const cow = live.simulateExit()
    const zoneName = cow ? plan.lots.find(lot => lot.id === cow.zoneId)?.name ?? 'su lote' : ''
    setActionMessage(cow
      ? `Vaca #${cow.tag} va saliendo del perímetro ${zoneName}.`
      : 'Todas las vacas disponibles ya están afuera o regresando. Espera unos segundos.')
  }

  return <section className={styles.section} aria-labelledby="farm-plan-title">
    <div className={styles.heading}>
      <div>
        <div className={styles.titleRow}>
          <h2 id="farm-plan-title" className={styles.title}>Monitoreo en vivo</h2>
          <span className={`${styles.liveStatus} ${live.paused ? styles.paused : ''}`}>
            <span className={styles.liveDot} aria-hidden="true" />{live.paused ? 'En pausa' : 'En vivo'}
          </span>
        </div>
        <p className={styles.note}>Simulación local del hato · posiciones y detecciones de demostración</p>
      </div>
      <div className={styles.controls} aria-label="Controles de la simulación">
        <Button variant="secondary" icon={live.paused ? Play : Pause} aria-pressed={live.paused}
          onClick={() => live.setPaused(!live.paused)}>{live.paused ? 'Reanudar' : 'Pausar'}</Button>
        <Button variant="ghost" icon={Gauge} onClick={live.toggleSpeed} aria-label={`Velocidad de la simulación ×${live.speed}. Cambiar a ×${live.speed === 1 ? 2 : 1}`}>
          Velocidad ×{live.speed}
        </Button>
        <Button icon={LogOut} onClick={simulateExit}>Simular salida</Button>
      </div>
    </div>

    <ul className={styles.markerLegend} aria-label="Leyenda del monitoreo">
      <li><span className={`${styles.legendMarker} ${styles.safeMarker}`} aria-hidden="true" />Ganado dentro</li>
      <li><span className={`${styles.legendMarker} ${styles.outsideMarker}`} aria-hidden="true" />Fuera del perímetro</li>
      <li><span className={`${styles.legendMarker} ${styles.personMarker}`} aria-hidden="true" />Persona</li>
    </ul>
    <p className={styles.actionStatus} role="status">{actionMessage}</p>
    <p className="visually-hidden" aria-live="polite">
      {outsideCows.length === 0 ? 'Todo el ganado está dentro del perímetro.' : outsideCows.map(cow => `Vaca #${cow.tag} fuera del perímetro ${cow.zoneName}.`).join(' ')}
    </p>

    <div className={styles.canvas}>
      <svg viewBox={`0 0 ${plan.width} ${plan.height}`} role="img"
        aria-label={`Plano animado con ${live.snapshot.insideCount} de ${live.snapshot.totalCount} vacas dentro del perímetro, ${outsideCows.length} fuera y ${live.snapshot.peopleCount} personas detectadas`}>
        <defs>
          {(['warning', 'critical'] as const).map(tone =>
            <pattern key={tone} id={`${hatchId}-${tone}`} width="8" height="8" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <path d="M 0 0 V 8" className={`${styles.hatchLine} ${styles[tone]}`} />
            </pattern>)}
        </defs>

        <g className={styles.terrain}>
          {plan.contours.map(path => <path key={path} d={path} />)}
        </g>
        <polyline className={styles.trackBed} points={points(plan.track)} />
        <polyline className={styles.track} points={points(plan.track)} />

        <g className={styles.lots}>
          {plan.lots.map(lot => {
            const state = simulatedBreaches.has(lot.id) ? 'breached' : lotState.get(lot.id)
            const ring = `${hatchId}-ring-${lot.id}`
            return <g key={lot.id} className={state ? styles[state] : undefined}>
              {state === 'breached' && <>
                <clipPath id={ring}>
                  <path fillRule="evenodd" d={`M0 0 H${plan.width} V${plan.height} H0 Z M${lot.boundary.map(({ x, y }) => `${x} ${y}`).join(' L')} Z`} />
                </clipPath>
                <polygon className={styles.outsideRing} points={points(lot.boundary)} clipPath={`url(#${ring})`} stroke={`url(#${hatchId}-critical)`} />
              </>}
              <polygon className={styles.lot} points={points(lot.boundary)} />
              {(state === 'warning' || state === 'critical') && <polygon points={points(lot.boundary)} fill={`url(#${hatchId}-${state})`} className={styles.lotHatch} />}
              <polygon className={styles.lindero} points={points(lot.boundary)} vectorEffect="non-scaling-stroke" />
              {lot.boundary.map(({ x, y }) => <rect key={`${x}-${y}`} className={styles.vertex} x={x - 3} y={y - 3} width="6" height="6" />)}
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
          {live.snapshot.people.map(person => <g key={person.id}
            ref={node => {
              if (node) personNodes.current.set(person.id, node)
              else personNodes.current.delete(person.id)
            }}
            transform={positionTransform(person.position)}>
            {/* Inner group: CSS scales the marker while the outer transform carries the position. */}
            <g className={styles.marker}>
              <circle className={styles.personHalo} r="13" />
              <circle className={styles.personHead} cx="0" cy="-4" r="3.5" />
              <path className={styles.personBody} d="M-6 9V3Q-6-2 0-2Q6-2 6 3V9Z" />
              <text className={styles.personLabel} x="0" y="27" textAnchor="middle">Persona</text>
            </g>
          </g>)}
        </g>

        <g className={styles.herd}>
          {/* Cows outside are drawn last so their red marker and label are never covered. */}
          {[...live.snapshot.cows].sort((a, b) => Number(a.outside) - Number(b.outside)).map(cow => <g key={cow.id}
            ref={node => {
              if (node) cowNodes.current.set(cow.id, node)
              else cowNodes.current.delete(cow.id)
            }}
            className={cow.outside ? styles.cowOutside : undefined}
            transform={positionTransform(cow.position)}>
            <CowAlarm cow={cow} />
            <g className={styles.marker}>
              {cow.outside && <circle className={styles.cowPulse} r="20" />}
              <circle className={styles.cowBody} r="15" />
              <path className={styles.cowHead} d="M-8-4-12-9-5-8C-2-11 2-11 5-8L12-9 8-4V4C8 11-8 11-8 4Z" />
              <circle className={styles.cowDetail} cx="-3" cy="-1" r="1.2" />
              <circle className={styles.cowDetail} cx="3" cy="-1" r="1.2" />
              <path className={styles.cowMuzzle} d="M-4 5Q0 8 4 5" />
              <rect className={styles.cowTagBackground} x="-15" y="13" width="30" height="17" rx="7" />
              <text className={styles.cowTag} x="0" y="25" textAnchor="middle">#{cow.tag}</text>
              {cow.outside && <g className={styles.outsideLabel}>
                <rect x="-62" y="-43" width="124" height="21" rx="10" />
                <text x="0" y="-28.5" textAnchor="middle">Fuera del perímetro</text>
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
  </section>
}
