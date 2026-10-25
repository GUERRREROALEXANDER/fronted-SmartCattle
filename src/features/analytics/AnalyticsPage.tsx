import { useEffect, useMemo, useState } from 'react'
import { CalendarSearch, Info } from 'lucide-react'
import { DataSourceBadge, EmptyState, ErrorState, Notice, PageHeader, Skeleton } from '../../components/ui'
import { useResource } from '../../lib/useResource'
import { FadeUp } from '../../motion'
import { listCameras, listEvents } from '../../services'
import { buildAnalyticsModel, type AnalyticsRange } from './analyticsModel'
import { CameraBars } from './CameraBars'
import { CategoryDonut } from './CategoryDonut'
import { ChartCard } from './ChartCard'
import { ConfidenceHistogram } from './ConfidenceHistogram'
import { DailyTrend } from './DailyTrend'
import { HourlyArea } from './HourlyArea'
import { KpiTile } from './KpiTile'
import { formatPercentage, percentageOf } from './percent'
import { RangeTabs } from './RangeTabs'
import { SeverityBar } from './SeverityBar'
import styles from './AnalyticsPage.module.css'

const rangeDescriptions: Record<AnalyticsRange, string> = {
  '24h': 'las últimas 24 horas',
  '7d': 'los últimos 7 días',
  '30d': 'los últimos 30 días',
}

const hourFormat = (value: number) => `${String(Math.round(value)).padStart(2, '0')}:00`
const percentFormat = (value: number) => formatPercentage(value)

export function AnalyticsPage() {
  const [range, setRange] = useState<AnalyticsRange>('24h')
  const [now, setNow] = useState(() => new Date())
  const events = useResource(signal => listEvents({ signal }), { refreshMs: 60_000 })
  const cameras = useResource(signal => listCameras({ signal }), { refreshMs: 60_000 })

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000)
    return () => clearInterval(timer)
  }, [])

  const eventData = events.data
  const cameraData = cameras.data
  const model = useMemo(
    () => buildAnalyticsModel(eventData ?? [], cameraData ?? [], range, now),
    [eventData, cameraData, range, now],
  )
  const loading = events.status === 'loading' || cameras.status === 'loading'
  const failed = (events.status === 'error' && events.data === null) || (cameras.status === 'error' && cameras.data === null)
  const stale = (events.status === 'error' && events.data !== null) || (cameras.status === 'error' && cameras.data !== null)
  const showDemoBadge = events.source === 'mock' || cameras.source === 'mock'
  const retry = () => {
    events.reload()
    cameras.reload()
  }
  const changeRange = (next: AnalyticsRange) => {
    setRange(next)
    setNow(new Date())
  }

  const categoryLeader = model.categories.reduce((leader, row) => row.count > leader.count ? row : leader)
  const dayLeader = model.days.reduce((leader, row) => row.total > leader.total ? row : leader)
  const knownConfidence = model.confidence.filter(row => row.id !== 'unknown')
  const confidenceLeader = knownConfidence.reduce((leader, row) => row.count > leader.count ? row : leader)
  const hasConfidence = knownConfidence.some(row => row.count > 0)
  const busiestHour = model.kpis.busiestHour
  const busiestCamera = model.kpis.busiestCamera

  return <div className={styles.page}>
    <PageHeader title="Análisis" actions={<>
      <RangeTabs value={range} onChange={changeRange} />
      {showDemoBadge && <DataSourceBadge />}
    </>} />

    <div id="analytics-panel" role="tabpanel" aria-labelledby={`analytics-tab-${range}`}
      className={styles.panel} aria-busy={loading}>
      {loading && <>
        <p className="visually-hidden" role="status">Cargando análisis…</p>
        <div className={styles.kpis} aria-hidden="true">
          {[0, 1, 2, 3, 4].map(index => <Skeleton key={index} height="5.75rem" />)}
        </div>
        <div className={styles.grid} aria-hidden="true">
          {[0, 1, 2, 3, 4, 5].map(index => <div key={index} className={index === 0 || index === 2 || index === 4 ? styles.wide : undefined}>
            <Skeleton height="22rem" radius="var(--radius-lg)" />
          </div>)}
        </div>
      </>}

      {!loading && failed && <ErrorState title="Análisis no disponible"
        description="No se pudo cargar la información de eventos y cámaras. Revisa la conexión y vuelve a intentarlo."
        onRetry={retry} />}

      {!loading && !failed && stale && <Notice tone="warning" title="No se pudo actualizar el análisis">
        Se muestran los datos de la última carga. El próximo reintento será automático.
      </Notice>}

      {!loading && !failed && events.data !== null && model.events.length === 0 && <EmptyState
        icon={CalendarSearch}
        title="No hay eventos en este periodo"
        description={`No se registraron eventos en ${rangeDescriptions[range]}. Prueba con un periodo más amplio; sin registros no significa que no haya actividad fuera del alcance de las cámaras.`} />}

      {!loading && !failed && model.events.length > 0 && <>
        <section aria-label="Indicadores principales">
          <FadeUp>
            <ul className={styles.kpis}>
              <KpiTile label="Eventos registrados" value={model.kpis.totalEvents}
                caption={`En ${rangeDescriptions[range]}`} />
              <KpiTile label="Fuera de la zona segura" value={model.kpis.cattleOutOfZonePercentage}
                format={percentFormat} caption="Porcentaje del total registrado" />
              <KpiTile label="Severidad crítica" value={model.kpis.criticalPercentage}
                format={percentFormat} caption="Porcentaje del total registrado" />
              {busiestHour && <KpiTile label="Hora con más eventos" value={busiestHour.hour}
                format={hourFormat} caption={`${busiestHour.count} eventos · ${formatPercentage(busiestHour.percentage)}`} />}
              {busiestCamera && <KpiTile label="Eventos en la cámara más activa" value={busiestCamera.count}
                caption={`${busiestCamera.name} · ${formatPercentage(busiestCamera.percentage)}`} />}
            </ul>
          </FadeUp>
        </section>

        <section className={styles.grid} aria-label="Gráficas del periodo">
          <ChartCard title="Evolución diaria por categoría" index={0} className={styles.wide}
            insight={`El día con más registros fue el ${dayLeader.label}: ${dayLeader.total} ${dayLeader.total === 1 ? 'evento' : 'eventos'}.`}
            table={{
              headers: ['Día', 'Ganado', 'Seguridad', 'Sistema', 'Total'],
              rows: model.days.map(row => [row.date, row.cattle, row.security, row.system, row.total]),
            }}>
            <DailyTrend data={model.days} />
          </ChartCard>

          <ChartCard title="Eventos por categoría" index={1}
            insight={`${categoryLeader.label} representa el ${categoryLeader.percentage} % de los eventos (${categoryLeader.count} de ${model.kpis.totalEvents}).`}
            table={{
              headers: ['Categoría', 'Eventos', 'Porcentaje'],
              rows: model.categories.map(row => [row.label, row.count, formatPercentage(row.percentage)]),
            }}>
            <CategoryDonut data={model.categories} />
          </ChartCard>

          <ChartCard title="Distribución por hora del día" index={2} className={styles.wide}
            insight={busiestHour
              ? `La franja de ${busiestHour.label} a ${hourFormat((busiestHour.hour + 1) % 24)} reúne ${busiestHour.count} eventos (${formatPercentage(busiestHour.percentage)}).`
              : 'No hay una franja horaria destacada.'}
            table={{
              headers: ['Hora', 'Eventos', 'Porcentaje'],
              rows: model.hours.map(row => [row.label, row.count, formatPercentage(percentageOf(row.count, model.kpis.totalEvents))]),
            }}>
            <HourlyArea data={model.hours} />
          </ChartCard>

          <ChartCard title="Severidad de los eventos" index={3}
            insight={`El ${model.severities[2].percentage} % de los eventos registrados es crítico (${model.severities[2].count} de ${model.kpis.totalEvents}).`}
            footnote={model.events.some(event => event.severitySource === 'catalog')
              ? 'La severidad se asigna con el catálogo cuando el servidor no la incluye.'
              : undefined}
            table={{
              headers: ['Severidad', 'Eventos', 'Porcentaje'],
              rows: model.severities.map(row => [row.label, row.count, formatPercentage(row.percentage)]),
            }}>
            <SeverityBar data={model.severities} />
          </ChartCard>

          <ChartCard title="Eventos por cámara" index={4} className={styles.wide}
            insight={busiestCamera
              ? `${busiestCamera.name} concentra ${busiestCamera.count} ${busiestCamera.count === 1 ? 'evento' : 'eventos'}, el ${busiestCamera.percentage} % del total.`
              : 'No hay una cámara destacada.'}
            table={{
              headers: ['Cámara', 'Eventos', 'Porcentaje'],
              rows: model.cameras.map(row => [row.name, row.count, formatPercentage(row.percentage)]),
            }}>
            <CameraBars data={model.cameras} />
          </ChartCard>

          <ChartCard title="Confianza del detector por evento" index={5}
            insight={hasConfidence
              ? `El grupo más frecuente es ${confidenceLeader.label}: ${confidenceLeader.count} de ${model.kpis.totalEvents} eventos.`
              : 'Ningún evento del periodo incluye un dato de confianza del detector.'}
            footnote="La confianza es el valor informado por el detector para cada evento; no mide la precisión del modelo."
            table={{
              headers: ['Confianza informada', 'Eventos', 'Porcentaje'],
              rows: model.confidence.map(row => [row.label, row.count, formatPercentage(row.percentage)]),
            }}>
            <ConfidenceHistogram data={model.confidence} />
          </ChartCard>
        </section>

        <p className={styles.scopeNote}>
          <Info size={18} strokeWidth={1.75} aria-hidden="true" />
          <span>Este análisis resume eventos registrados por las cámaras. Menos registros no significa menos animales: la oclusión, el ángulo o la iluminación pueden afectar la detección.</span>
        </p>
      </>}
    </div>
  </div>
}
