import { useId } from 'react'
import { useReducedMotion } from 'motion/react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import { GlassCard } from '../../components/ui'
import { staggerDelay } from '../../motion'
import { ChartTooltip } from '../analytics/ChartTooltip'
import type { LiveChartPoint, LiveHerdSnapshot } from './liveHerd'
import styles from './LiveCharts.module.css'

const axisTick = { fill: 'var(--color-ink-subtle)', fontFamily: 'var(--font-sans)', fontSize: 11 }
const trendValue = (value: number | string, name: string) => name.includes('%') ? `${value} %` : String(value)

export function LiveCharts({ snapshot, points, trendClassName, zonesClassName, staggerFrom = 0 }: {
  snapshot: LiveHerdSnapshot
  points: readonly LiveChartPoint[]
  trendClassName?: string
  zonesClassName?: string
  /** Stagger index of the first card. */
  staggerFrom?: number
}) {
  const animate = !useReducedMotion()
  const gradientId = `live-${useId().replace(/:/g, '')}`
  const trendSummary = `Últimos 60 segundos: ahora ${snapshot.insidePercentage} % del ganado dentro del perímetro y ${snapshot.detectionsPerMinute} detecciones por minuto.`
  const zoneSummary = `Alertas por zona: ${snapshot.zones.map(zone => `${zone.name} ${zone.alerts}`).join(', ')}.`
  const data = [...points]

  return <>
    <GlassCard as="section" padding="none" delay={staggerDelay(staggerFrom)}
      className={[styles.card, trendClassName].filter(Boolean).join(' ')} aria-label="Gráfica de los últimos 60 segundos">
      <figure className={styles.figure} aria-labelledby="live-trend-title">
        <figcaption className={styles.caption}>
          <h2 id="live-trend-title" className={styles.title}>Últimos 60 segundos</h2>
          <ul className={styles.legend} aria-hidden="true">
            <li><span className={styles.swatchInside} />Dentro del perímetro (%)</li>
            <li><span className={styles.swatchDetections} />Detecciones/min</li>
          </ul>
        </figcaption>
        <div className={styles.plot} role="img" aria-label={trendSummary}>
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={data} margin={{ top: 8, right: 0, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`${gradientId}-inside`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-brand)" stopOpacity={0.34} />
                  <stop offset="100%" stopColor="var(--color-mint)" stopOpacity={0.02} />
                </linearGradient>
                <linearGradient id={`${gradientId}-detections`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-info)" stopOpacity={0.2} />
                  <stop offset="100%" stopColor="var(--color-sky)" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-rule)" strokeOpacity={0.7} strokeDasharray="3 6" vertical={false} />
              <XAxis dataKey="label" minTickGap={48} tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis yAxisId="percent" domain={[0, 100]} width={40} unit="%" tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis yAxisId="detections" orientation="right" width={34} allowDecimals={false}
                domain={[0, (max: number) => Math.max(40, Math.ceil(max * 1.2 / 40) * 40)]} tickCount={5} tick={axisTick} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip formatValue={trendValue} />} cursor={{ stroke: 'var(--color-rule-strong)', strokeDasharray: '3 4' }}
                wrapperStyle={{ outline: 'none' }} />
              <Area yAxisId="detections" type="monotone" dataKey="detections" name="Detecciones/min"
                stroke="var(--color-info)" fill={`url(#${gradientId}-detections)`} strokeWidth={2.25}
                dot={false} activeDot={{ r: 4.5, fill: 'var(--color-info)', stroke: 'var(--color-surface-raised)', strokeWidth: 2 }}
                isAnimationActive={animate} animationDuration={600} animationEasing="ease-out" />
              <Area yAxisId="percent" type="monotone" dataKey="insidePercentage" name="Dentro del perímetro (%)"
                stroke="var(--color-brand)" fill={`url(#${gradientId}-inside)`} strokeWidth={2.75}
                dot={false} activeDot={{ r: 4.5, fill: 'var(--color-brand)', stroke: 'var(--color-surface-raised)', strokeWidth: 2 }}
                isAnimationActive={animate} animationDuration={600} animationEasing="ease-out" />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </figure>
    </GlassCard>

    <GlassCard as="section" padding="none" delay={staggerDelay(staggerFrom + 1)}
      className={[styles.card, zonesClassName].filter(Boolean).join(' ')} aria-label="Gráfica de alertas por zona">
      <figure className={styles.figure} aria-labelledby="zone-alerts-title">
        <figcaption className={styles.caption}>
          <h2 id="zone-alerts-title" className={styles.title}>Alertas por zona</h2>
          <p className={styles.note}>Cada salida suma una alerta a su lote.</p>
        </figcaption>
        <div className={`${styles.plot} ${styles.bars}`} role="img" aria-label={zoneSummary}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={snapshot.zones} margin={{ top: 20, right: 4, bottom: 0, left: 0 }}>
              <defs>
                <linearGradient id={`${gradientId}-bar`} x1="0" y1="0" x2="0" y2="1">
                  <stop offset="0%" stopColor="var(--color-alarm)" stopOpacity={0.92} />
                  <stop offset="100%" stopColor="var(--color-peach)" stopOpacity={0.75} />
                </linearGradient>
              </defs>
              <CartesianGrid stroke="var(--color-rule)" strokeOpacity={0.7} strokeDasharray="3 6" vertical={false} />
              <XAxis dataKey="name" interval={0} tick={axisTick} tickLine={false} axisLine={false} />
              <YAxis width={26} allowDecimals={false} domain={[0, (max: number) => Math.max(3, max + 1)]}
                tick={axisTick} tickLine={false} axisLine={false} />
              <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-hover)', radius: 10 }} wrapperStyle={{ outline: 'none' }} />
              <Bar dataKey="alerts" name="Alertas" fill={`url(#${gradientId}-bar)`}
                radius={[10, 10, 4, 4]} maxBarSize={44} background={{ fill: 'var(--glass-fill-subtle)', radius: 10 }}
                isAnimationActive={animate} animationDuration={700} animationEasing="ease-out">
                <LabelList dataKey="alerts" position="top" fill="var(--color-alarm-ink)" fontSize={12} fontWeight={700} />
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </figure>
    </GlassCard>
  </>
}
