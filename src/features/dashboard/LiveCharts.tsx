import { useId, useState } from 'react'
import { Pause, Play } from 'lucide-react'
import {
  Area, Bar, BarChart, CartesianGrid, ComposedChart, Line, ResponsiveContainer, Tooltip, XAxis, YAxis,
} from 'recharts'
import { GlassCard, Skeleton } from '../../components/ui'
import type { HerdPoint } from '../../live/liveState'
import { useResource } from '../../lib/useResource'
import { staggerDelay } from '../../motion'
import { getAlertReport, getOccupancyHistory } from '../../services'
import type { AlertDay } from '../../types/domain'
import { clock, farmMinutes, weekDays, type TrendPoint } from './dashboardModel'
import { ChartTooltip } from '../analytics/ChartTooltip'
import styles from './LiveCharts.module.css'

// Palettes checked with the dataviz validator (CVD, normal vision, contrast) against the light surface:
// trend brand/alarm-ink, severity info/warning/alarm-ink. All tokens, no new colors.
const series = { inside: 'var(--color-brand)', outside: 'var(--color-alarm-ink)' }
const severity = { info: 'var(--color-info)', warning: 'var(--color-warning)', critical: 'var(--color-alarm-ink)' } as const
const severityLabel = { info: 'Informativa', warning: 'Advertencia', critical: 'Crítica' } as const

const axisTick = { fill: 'var(--color-ink-subtle)', fontFamily: 'var(--font-sans)', fontSize: 11 }
const grid = { stroke: 'var(--color-rule)', strokeOpacity: 0.7, strokeDasharray: '3 6', vertical: false } as const
const surfaceRing = { stroke: 'var(--color-surface-raised)', strokeWidth: 2 }

type Range = 'session' | 'hours'
const RANGES: { id: Range; label: string }[] = [{ id: 'session', label: 'Sesión' }, { id: 'hours', label: 'Últimas 6 h' }]
const HOURS = 6
const HOUR_MS = 3_600_000
const HISTORY_REFRESH_MS = 60_000
const REPORT_REFRESH_MS = 5 * 60_000

const fromHistory = (history: readonly HerdPoint[]): TrendPoint[] =>
  history.map(point => ({ at: point.at.getTime(), label: clock(point.at, true), inside: point.inside, outside: point.outside }))

/** "2026-10-31" → "vie 31". Parsed as a local day, never shifted by the time zone. */
function dayLabel(day: string): string {
  const [year, month, date] = day.split('-').map(Number)
  return new Date(year, month - 1, date).toLocaleDateString('es-CO', { weekday: 'short', day: 'numeric' }).replace('.', '')
}

export function LiveCharts({ history, reduceMotion, trendClassName, alertsClassName, staggerFrom = 0 }: {
  /** This session's farm-wide head count from the live channel. */
  history: readonly HerdPoint[]
  reduceMotion: boolean
  trendClassName?: string
  alertsClassName?: string
  staggerFrom?: number
}) {
  const [range, setRange] = useState<Range>('session')
  // Pausing keeps the session line still so a value can be read; the live state keeps updating underneath.
  const [frozen, setFrozen] = useState<readonly HerdPoint[] | null>(null)
  const gradientId = `trend-${useId().replace(/:/g, '')}`
  const occupancy = useResource(signal => {
    const end = new Date()
    return getOccupancyHistory({ start: new Date(end.getTime() - HOURS * HOUR_MS), end }, { signal })
  }, { key: range, refreshMs: range === 'hours' ? HISTORY_REFRESH_MS : undefined })
  const report = useResource(signal => {
    const end = new Date()
    const start = new Date(end)
    start.setDate(start.getDate() - 6)
    start.setHours(0, 0, 0, 0)
    return getAlertReport({ start, end }, { signal })
  }, { refreshMs: REPORT_REFRESH_MS })

  const trend = range === 'session' ? fromHistory(frozen ?? history) : farmMinutes(occupancy.data ?? [])
  const latest = trend.at(-1)
  const peakOutside = trend.reduce((peak, point) => Math.max(peak, point.outside), 0)
  const trendSummary = latest
    ? `${RANGES.find(item => item.id === range)!.label}: ahora ${latest.inside} dentro y ${latest.outside} fuera de zona; máximo fuera ${peakOutside}.`
    : 'Todavía no hay conteos de las cámaras.'
  const trendLoading = range === 'hours' && occupancy.status === 'loading'
  const days: AlertDay[] = report.data ? weekDays(report.data.days, new Date()) : []
  const weekTotal = days.reduce((sum, day) => sum + day.total, 0)
  const weekCritical = days.reduce((sum, day) => sum + day.critical, 0)
  const ack = report.data?.avgMinutesToAcknowledge
  const animate = !reduceMotion
  // The session line grows with every push; replaying the entrance each time would keep it invisible.
  const animateTrend = animate && range === 'hours'

  return <>
    <GlassCard as="section" padding="none" delay={staggerDelay(staggerFrom)}
      className={[styles.card, trendClassName].filter(Boolean).join(' ')} aria-labelledby="herd-trend-title">
      <figure className={styles.figure}>
        <figcaption className={styles.caption}>
          <div className={styles.captionRow}>
            <h2 id="herd-trend-title" className={styles.title}>Hato dentro y fuera de zona</h2>
            <div className={styles.controls}>
            {range === 'session' && <button type="button" className={styles.pause} aria-pressed={frozen !== null}
              onClick={() => setFrozen(frozen ? null : [...history])}>
              {frozen ? <Play size={14} strokeWidth={2.25} aria-hidden="true" /> : <Pause size={14} strokeWidth={2.25} aria-hidden="true" />}
              {frozen ? 'Reanudar' : 'Pausar'}
            </button>}
            <div className={styles.ranges} role="group" aria-label="Periodo de la gráfica">
              {RANGES.map(item => <button key={item.id} type="button" className={styles.range}
                aria-pressed={range === item.id} onClick={() => setRange(item.id)}>{item.label}</button>)}
            </div>
            </div>
          </div>
          <ul className={styles.legend}>
            <li><span className={styles.swatch} style={{ background: series.inside }} aria-hidden="true" />Dentro de zona</li>
            <li><span className={styles.swatch} style={{ background: series.outside }} aria-hidden="true" />Fuera de zona</li>
          </ul>
        </figcaption>
        <div className={styles.plot} role="img" aria-label={trendSummary}>
          {trendLoading ? <Skeleton height="100%" radius="var(--radius-md)" />
            : trend.length < 2 ? <p className={styles.empty}>
              {range === 'session' ? 'La línea aparece en cuanto las cámaras envían su segundo conteo.' : 'El servidor no tiene conteos de las últimas horas.'}
            </p>
            : <ResponsiveContainer width="100%" height="100%">
              <ComposedChart data={trend} margin={{ top: 8, right: 8, bottom: 0, left: 0 }}>
                <defs>
                  <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={series.inside} stopOpacity={0.22} />
                    <stop offset="100%" stopColor={series.inside} stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid {...grid} />
                <XAxis dataKey="label" minTickGap={56} tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis width={32} allowDecimals={false} domain={[0, (max: number) => Math.max(4, Math.ceil(max * 1.15))]}
                  tick={axisTick} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ stroke: 'var(--color-rule-strong)', strokeDasharray: '3 4' }}
                  wrapperStyle={{ outline: 'none' }} />
                <Area type="monotone" dataKey="inside" name="Dentro de zona" stroke={series.inside} strokeWidth={2}
                  fill={`url(#${gradientId})`} dot={false} activeDot={{ r: 4, fill: series.inside, ...surfaceRing }}
                  isAnimationActive={animateTrend} animationDuration={400} animationEasing="ease-out" />
                <Line type="monotone" dataKey="outside" name="Fuera de zona" stroke={series.outside} strokeWidth={2}
                  dot={false} activeDot={{ r: 4, fill: series.outside, ...surfaceRing }}
                  isAnimationActive={animateTrend} animationDuration={400} animationEasing="ease-out" />
              </ComposedChart>
            </ResponsiveContainer>}
        </div>
      </figure>
    </GlassCard>

    <GlassCard as="section" padding="none" delay={staggerDelay(staggerFrom + 1)}
      className={[styles.card, alertsClassName].filter(Boolean).join(' ')} aria-labelledby="alert-days-title">
      <figure className={styles.figure}>
        <figcaption className={styles.caption}>
          <h2 id="alert-days-title" className={styles.title}>Alertas de los últimos 7 días</h2>
          <p className={styles.note}>
            {report.data ? `${weekTotal} alertas, ${weekCritical} críticas` : 'Cargando el reporte…'}
            {ack !== null && ack !== undefined && ` · se reconocen en ${Math.round(ack)} min en promedio`}
          </p>
          <ul className={styles.legend}>
            {(['critical', 'warning', 'info'] as const).map(level => <li key={level}>
              <span className={styles.swatch} style={{ background: severity[level] }} aria-hidden="true" />{severityLabel[level]}
            </li>)}
          </ul>
        </figcaption>
        <div className={`${styles.plot} ${styles.bars}`} role="img"
          aria-label={`Alertas por día: ${days.map(day => `${dayLabel(day.day)} ${day.total} (${day.critical} críticas)`).join(', ')}.`}>
          {report.status === 'loading' ? <Skeleton height="100%" radius="var(--radius-md)" />
            : weekTotal === 0 ? <p className={styles.empty}>Sin alertas registradas esta semana.</p>
            : <ResponsiveContainer width="100%" height="100%">
              <BarChart data={days.map(day => ({ ...day, label: dayLabel(day.day) }))} margin={{ top: 8, right: 4, bottom: 0, left: 0 }}>
                <CartesianGrid {...grid} />
                <XAxis dataKey="label" interval={0} tick={axisTick} tickLine={false} axisLine={false} />
                <YAxis width={28} allowDecimals={false} domain={[0, (max: number) => Math.max(3, max)]}
                  tick={axisTick} tickLine={false} axisLine={false} />
                <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-hover)', radius: 8 }} wrapperStyle={{ outline: 'none' }} />
                {/* Bottom to top: informative, warning, critical. A 2px surface stroke separates the segments. */}
                {(['info', 'warning', 'critical'] as const).map(level => <Bar key={level} dataKey={level} stackId="severity"
                  name={severityLabel[level]} fill={severity[level]} stroke="var(--color-surface-raised)" strokeWidth={2}
                  radius={level === 'critical' ? [4, 4, 0, 0] : 0} maxBarSize={30}
                  isAnimationActive={animate} animationDuration={500} animationEasing="ease-out" />)}
              </BarChart>
            </ResponsiveContainer>}
        </div>
        {/* Table view of the stacked bars for screen readers; the wrapper clips it, not the table. */}
        {days.length > 0 && <div className="visually-hidden">
          <table>
            <caption>Alertas por día y severidad</caption>
            <thead><tr><th scope="col">Día</th><th scope="col">Críticas</th><th scope="col">Advertencias</th><th scope="col">Informativas</th><th scope="col">Total</th></tr></thead>
            <tbody>{days.map(day => <tr key={day.day}>
              <th scope="row">{dayLabel(day.day)}</th><td>{day.critical}</td><td>{day.warning}</td><td>{day.info}</td><td>{day.total}</td>
            </tr>)}</tbody>
          </table>
        </div>}
      </figure>
    </GlassCard>
  </>
}
