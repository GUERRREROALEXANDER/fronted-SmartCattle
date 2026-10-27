import { useReducedMotion } from 'motion/react'
import {
  Area,
  Bar,
  BarChart,
  CartesianGrid,
  ComposedChart,
  LabelList,
  Line,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts'
import type { LiveChartPoint, LiveHerdSnapshot } from './liveHerd'
import styles from './LiveCharts.module.css'

const axisTick = { fill: 'var(--color-ink-subtle)', fontFamily: 'var(--font-sans)', fontSize: 11 }
const tooltipStyles = {
  contentStyle: {
    backgroundColor: 'var(--color-surface-raised)',
    border: '1px solid var(--color-rule-strong)',
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-raised)',
    color: 'var(--color-ink)',
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-sm)',
  },
  labelStyle: { color: 'var(--color-ink)', fontWeight: 600 },
  wrapperStyle: { outline: 'none' },
}

export function LiveCharts({ snapshot, points }: { snapshot: LiveHerdSnapshot; points: readonly LiveChartPoint[] }) {
  const animate = !useReducedMotion()
  const trendSummary = `Últimos 60 segundos: ahora ${snapshot.insidePercentage} % del ganado dentro del perímetro y ${snapshot.detectionsPerMinute} detecciones por minuto.`
  const zoneSummary = `Alertas por zona: ${snapshot.zones.map(zone => `${zone.name} ${zone.alerts}`).join(', ')}.`
  const data = [...points]

  return <section className={styles.section} aria-label="Gráficas en tiempo real">
    <figure className={styles.card} aria-labelledby="live-trend-title">
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
            <CartesianGrid stroke="var(--color-rule)" strokeDasharray="3 5" vertical={false} />
            <XAxis dataKey="label" minTickGap={48} tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--color-rule-strong)' }} />
            <YAxis yAxisId="percent" domain={[0, 100]} width={40} unit="%" tick={axisTick} tickLine={false} axisLine={false} />
            <YAxis yAxisId="detections" orientation="right" width={34} allowDecimals={false}
              domain={[0, (max: number) => Math.max(40, Math.ceil(max * 1.2 / 40) * 40)]} tickCount={5} tick={axisTick} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipStyles} cursor={{ stroke: 'var(--color-rule-strong)' }} />
            <Area yAxisId="percent" type="monotone" dataKey="insidePercentage" name="Dentro del perímetro (%)"
              stroke="var(--color-brand)" fill="var(--color-mint)" fillOpacity={0.85} strokeWidth={2.5}
              dot={false} activeDot={{ r: 4, fill: 'var(--color-brand)', stroke: 'var(--color-surface-raised)' }}
              isAnimationActive={animate} animationDuration={600} animationEasing="ease-out" />
            <Line yAxisId="detections" type="monotone" dataKey="detections" name="Detecciones/min"
              stroke="var(--color-info)" strokeWidth={2.5} dot={false}
              activeDot={{ r: 4, fill: 'var(--color-info)', stroke: 'var(--color-surface-raised)' }}
              isAnimationActive={animate} animationDuration={600} animationEasing="ease-out" />
          </ComposedChart>
        </ResponsiveContainer>
      </div>
    </figure>

    <figure className={styles.card} aria-labelledby="zone-alerts-title">
      <figcaption className={styles.caption}>
        <h2 id="zone-alerts-title" className={styles.title}>Alertas por zona</h2>
        <p className={styles.note}>Cada salida suma una alerta a su lote.</p>
      </figcaption>
      <div className={`${styles.plot} ${styles.bars}`} role="img" aria-label={zoneSummary}>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={snapshot.zones} margin={{ top: 20, right: 4, bottom: 0, left: 0 }}>
            <CartesianGrid stroke="var(--color-rule)" strokeDasharray="3 5" vertical={false} />
            <XAxis dataKey="name" interval={0} tick={axisTick} tickLine={false} axisLine={{ stroke: 'var(--color-rule-strong)' }} />
            <YAxis width={26} allowDecimals={false} domain={[0, (max: number) => Math.max(3, max + 1)]}
              tick={axisTick} tickLine={false} axisLine={false} />
            <Tooltip {...tooltipStyles} cursor={{ fill: 'var(--color-hover)' }} />
            <Bar dataKey="alerts" name="Alertas" fill="var(--color-peach)" stroke="var(--color-alarm)" strokeWidth={2}
              radius={[8, 8, 0, 0]} maxBarSize={56}
              isAnimationActive={animate} animationDuration={700} animationEasing="ease-out">
              <LabelList dataKey="alerts" position="top" fill="var(--color-alarm-ink)" fontSize={12} fontWeight={600} />
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </figure>
  </section>
}
