import { useState } from 'react'
import { ChevronLeft, ChevronRight, OctagonAlert } from 'lucide-react'
import { Link } from 'react-router'
import { motion, useReducedMotion } from 'motion/react'
import { describeApiError } from '../../api/errors'
import { PrintedCow } from '../../components/herd/PrintedCow'
import { Button, EmptyState, ErrorState, PageHeader, Skeleton } from '../../components/ui'
import { formatCount } from '../../lib/format'
import { useResource } from '../../lib/useResource'
import { ease } from '../../motion'
import { getDailyReport } from '../../services'
import type { DailyReport } from '../../types/domain'
import { dayKey, dayTitle, observedText, postureShares, shiftDay } from './reportModel'
import styles from './ReportPage.module.css'

const REFRESH_MS = 5 * 60_000
const POSTURE = { lying: 'lying', standing: 'standing', walking: 'walking' } as const
const NOTICE = {
  prolonged_lying: 'El ganado pasó echado la mayor parte del tiempo observado',
  little_lying: 'El ganado se echó poco durante el tiempo observado',
} as const

function Figures({ report }: { report: DailyReport }) {
  const reduce = useReducedMotion()
  const { herd, alerts } = report
  const rows = postureShares(herd)
  const figures = [
    { label: 'Tiempo observado', value: observedText(herd.observedMinutes) },
    { label: 'Máximo a la vista', value: formatCount(herd.peakCattle) },
    { label: 'Alertas', value: formatCount(alerts.total) },
    { label: 'Eventos detectados', value: formatCount(report.eventsTotal) },
  ]
  return <>
    {report.notices.length > 0 && <ul className={styles.notices}>
      {report.notices.map(notice => <li key={`${notice.cameraId}-${notice.kind}`}>
        <OctagonAlert size={20} strokeWidth={2} aria-hidden="true" />
        <span><strong>{NOTICE[notice.kind]}</strong> en {notice.cameraId} ({Math.round(notice.lyingShare * 100)} % echado). Conviene ir a mirar. No es un diagnóstico.</span>
      </li>)}
    </ul>}

    <dl className={styles.figures}>
      {figures.map(figure => <div key={figure.label}><dd className={styles.value}>{figure.value}</dd><dt>{figure.label}</dt></div>)}
    </dl>

    <section aria-labelledby="posture-title" className={styles.section}>
      <h2 id="posture-title" className={styles.heading}>Qué hizo el ganado</h2>
      {rows.length === 0
        ? <p className={styles.quiet}>Las cámaras no registraron la postura de ningún animal este día.</p>
        : <ul className={styles.postures}>
          {rows.map((row, index) => <li key={row.key} className={styles.posture}>
            <PrintedCow posture={POSTURE[row.key]} className={styles.cow} />
            <span className={styles.postureName}>{row.label}</span>
            <span className={styles.track}>
              <motion.span className={styles.fill} data-posture={row.key} style={{ transformOrigin: 'left' }}
                initial={reduce ? false : { transform: 'scaleX(0)' }} animate={{ transform: `scaleX(${row.share})` }}
                transition={{ duration: 0.6, ease: ease.out, delay: index * 0.06 }} />
            </span>
            <span className={styles.share}>{Math.round(row.share * 100)} %</span>
            <span className={styles.minutes}>{observedText(row.minutes)}</span>
          </li>)}
        </ul>}
    </section>

    <section aria-labelledby="alerts-title" className={styles.section}>
      <h2 id="alerts-title" className={styles.heading}>Alertas del día</h2>
      {alerts.total === 0
        ? <p className={styles.quiet}>No se registraron alertas.</p>
        : <>
          <dl className={styles.alerts}>
            <div data-level="critical"><dd>{alerts.critical}</dd><dt>Críticas</dt></div>
            <div data-level="warning"><dd>{alerts.warning}</dd><dt>Advertencias</dt></div>
            <div data-level="info"><dd>{alerts.info}</dd><dt>Informativas</dt></div>
            <div><dd>{alerts.open}</dd><dt>Abiertas</dt></div>
            <div><dd>{alerts.resolved}</dd><dt>Resueltas</dt></div>
          </dl>
          <p className={styles.more}><Link to="/events">Ver cada evento con su cámara y su hora</Link></p>
        </>}
    </section>

    <p className={styles.note}>
      {report.complete ? 'Día completo.' : 'Día en curso: las cifras siguen cambiando.'} Calculado de lo que vieron las cámaras; no es un diagnóstico veterinario.
    </p>
  </>
}

/** One calendar day of the herd, read from GET /api/reports/daily: nobody has to generate or send it. */
export function ReportPage() {
  const today = dayKey(new Date())
  const [day, setDay] = useState(today)
  const report = useResource(signal => getDailyReport({ signal, day }), { key: day, refreshMs: day === today ? REFRESH_MS : undefined })
  const data = report.data
  const empty = data && data.herd.observedMinutes === 0 && data.alerts.total === 0 && data.eventsTotal === 0
  return <div className={styles.page}>
    <PageHeader title="Informe diario" />
    <nav className={styles.days} aria-label="Elegir día">
      <Button variant="secondary" size="sm" icon={ChevronLeft} onClick={() => setDay(shiftDay(day, -1))}>Día anterior</Button>
      <p className={styles.day} aria-live="polite">{dayTitle(day, today)}</p>
      <Button variant="secondary" size="sm" icon={ChevronRight} disabled={day >= today} onClick={() => setDay(shiftDay(day, 1))}>Día siguiente</Button>
    </nav>
    {report.status === 'loading' && <Skeleton height="16rem" />}
    {report.status === 'error' && !data && <ErrorState {...describeApiError(report.error)} onRetry={report.reload} />}
    {empty && <EmptyState title="Sin actividad este día" description="Ninguna cámara registró ganado ni alertas. Si esperabas datos, revisa que las cámaras estén conectadas." />}
    {data && !empty && <Figures report={data} />}
  </div>
}
