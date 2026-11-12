import { ClipboardList } from 'lucide-react'
import { Link } from 'react-router'
import { GlassCard, Skeleton } from '../../components/ui'
import { formatCount } from '../../lib/format'
import { useResource } from '../../lib/useResource'
import { getDailyReport } from '../../services'
import type { DailyReport } from '../../types/domain'
import styles from './DailyReportCard.module.css'

const REFRESH_MS = 5 * 60_000

const noticeText = {
  prolonged_lying: 'pasó echado la mayor parte del tiempo observado',
  little_lying: 'se echó poco durante el tiempo observado',
} as const

function observed(minutes: number) {
  return minutes < 90 ? `${minutes} min` : `${Math.round(minutes / 60)} h`
}

function Figures({ report }: { report: DailyReport }) {
  const { herd, alerts } = report
  return <>
    <dl className={styles.figures}>
      <div><dt>Observado</dt><dd className="tabular">{observed(herd.observedMinutes)}</dd></div>
      <div><dt>Máximo a la vista</dt><dd className="tabular">{formatCount(herd.peakCattle)}</dd></div>
      <div><dt>Tiempo echado</dt><dd className="tabular">{herd.lyingShare === null ? '—' : `${Math.round(herd.lyingShare * 100)} %`}</dd></div>
      <div><dt>Alertas</dt><dd className="tabular">{formatCount(alerts.total)}{alerts.open > 0 && <small> ({alerts.open} {alerts.open === 1 ? 'abierta' : 'abiertas'})</small>}</dd></div>
    </dl>
    {report.notices.length > 0 && <ul className={styles.notices}>
      {report.notices.map(notice => <li key={`${notice.cameraId}-${notice.kind}`}>
        En {notice.cameraId} el ganado {noticeText[notice.kind]}: conviene ir a mirar.
      </li>)}
    </ul>}
    <p className={styles.note}>Calculado de lo que vieron las cámaras; no es un diagnóstico veterinario.</p>
    <p className={styles.note}><Link to="/informe">Ver el informe completo</Link></p>
  </>
}

/** Today's summary, built by the server from the detections: nobody has to generate or send it. */
export function DailyReportCard({ className, delay }: { className?: string; delay?: number }) {
  const report = useResource(signal => getDailyReport({ signal }), { refreshMs: REFRESH_MS })
  const data = report.data
  return <GlassCard as="section" padding="none" delay={delay} aria-labelledby="daily-report-title"
    className={[styles.card, className].filter(Boolean).join(' ')}>
    <div className={styles.heading}>
      <span className={styles.badge} aria-hidden="true"><ClipboardList size={18} strokeWidth={2} /></span>
      <h2 id="daily-report-title" className={styles.title}>Resumen de hoy{report.source === 'mock' && ' (simulado)'}</h2>
    </div>
    {report.status === 'loading'
      ? <Skeleton width="24ch" height="1.6em" />
      : data === null
      ? <p className={styles.empty}>No se pudo cargar el resumen. Se reintenta automáticamente.</p>
      : data.herd.observedMinutes === 0 && data.alerts.total === 0
      ? <p className={styles.empty}>Hoy ninguna cámara ha registrado actividad todavía.</p>
      : <Figures report={data} />}
  </GlassCard>
}
