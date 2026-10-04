import { useId } from 'react'
import { ChevronRight } from 'lucide-react'
import { Link } from 'react-router'
import type { FarmPlan as FarmPlanData, PlanCamera, PlanPoint } from '../../services'
import type { Camera, CameraStatus, FarmEvent, Severity } from '../../types/domain'
import styles from './FarmPlan.module.css'

interface FarmPlanProps {
  plan: FarmPlanData
  cameras: Camera[] | null
  alerts: FarmEvent[]
}

const statusLabel: Record<CameraStatus, string> = {
  online: 'En línea', connecting: 'Conectando', offline: 'Sin conexión', error: 'Con error',
}

const points = (boundary: readonly PlanPoint[]) => boundary.map(({ x, y }) => `${x},${y}`).join(' ')

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

export function FarmPlan({ plan, cameras, alerts }: FarmPlanProps) {
  const hatchId = `plan-hatch-${useId()}`
  const alertByCamera = new Map<string, Severity>()
  for (const alert of alerts) if (!alertByCamera.has(alert.cameraId)) alertByCamera.set(alert.cameraId, alert.severity)
  const alertLots = new Map(plan.cameras.filter(camera => alertByCamera.has(camera.cameraId))
    .map(camera => [camera.lotId, alertByCamera.get(camera.cameraId)!]))
  const cameraById = new Map(cameras?.map(camera => [camera.id, camera]))

  return <section className={styles.section} aria-labelledby="farm-plan-title">
    <div className={styles.heading}>
      <h2 id="farm-plan-title" className={styles.title}>Plano de la finca</h2>
      <p className={styles.note}>Esquema ilustrativo · posiciones aproximadas</p>
    </div>

    <div className={styles.canvas}>
      <svg viewBox={`0 0 ${plan.width} ${plan.height}`} role="img"
        aria-label={`Plano con ${plan.lots.length} lotes y ${plan.cameras.length} cámaras`}>
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
            const severity = alertLots.get(lot.id)
            return <g key={lot.id} className={severity ? styles[severity] : undefined}>
              <polygon className={styles.lot} points={points(lot.boundary)} />
              {severity && <polygon points={points(lot.boundary)} fill={`url(#${hatchId}-${severity === 'critical' ? 'critical' : 'warning'})`} className={styles.lotHatch} />}
              <polygon className={styles.lindero} points={points(lot.boundary)} vectorEffect="non-scaling-stroke" />
              {lot.boundary.map(({ x, y }) => <rect key={`${x}-${y}`} className={styles.vertex} x={x - 3} y={y - 3} width="6" height="6" />)}
              <text className={styles.lotLabel} x={lot.labelAt.x} y={lot.labelAt.y}>{lot.name}</text>
            </g>
          })}
        </g>

        {plan.cameras.map(point => {
          const camera = cameraById.get(point.cameraId)
          const status = camera?.status ?? 'offline'
          const severity = alertByCamera.get(point.cameraId)
          return <g key={point.cameraId} className={`${styles.point} ${styles[status]}`}>
            <path className={styles.wedge} d={viewWedge(point)} />
            {severity && <circle className={`${styles.pulse} ${styles[severity]}`} cx={point.position.x} cy={point.position.y} r="10" />}
            <circle className={styles.pointRing} cx={point.position.x} cy={point.position.y} r="8" />
            <circle className={styles.pointDot} cx={point.position.x} cy={point.position.y} r="3.5" />
            <text className={styles.pointLabel} x={point.position.x + (point.labelLeft ? -14 : 14)} y={point.position.y + 4}
              textAnchor={point.labelLeft ? 'end' : 'start'}>
              {camera?.name ?? point.cameraId}
            </text>
          </g>
        })}
      </svg>
    </div>

    {cameras && <ul className={styles.legend} aria-label="Cámaras">
      {plan.cameras.map(point => {
        const camera = cameraById.get(point.cameraId)
        if (!camera) return null
        const severity = alertByCamera.get(camera.id)
        return <li key={camera.id}>
          <Link className={styles.legendItem} to={`/live?camera=${encodeURIComponent(camera.id)}`}>
            <span className={`${styles.legendDot} ${styles[camera.status]}`} aria-hidden="true" />
            <span className={styles.legendText}>
              <span className={styles.legendName}>{camera.name}</span>
              <span className={styles.legendMeta}>
                {camera.location} · {statusLabel[camera.status]}
                {severity && <strong className={styles[severity]}> · Con alerta</strong>}
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
