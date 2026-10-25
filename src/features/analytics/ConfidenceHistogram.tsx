import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ConfidenceShare } from './analyticsModel'
import { axisLine, axisTick, chartAnimation, chartColors, confidenceColors, gridLine, tooltipStyles, useChartAnimation } from './chartTheme'
import styles from './ConfidenceHistogram.module.css'

export function ConfidenceHistogram({ data }: { data: ConfidenceShare[] }) {
  const animate = useChartAnimation()
  return <div className={styles.chart} aria-hidden="true">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 24, right: 4, bottom: 0, left: 0 }}>
        <CartesianGrid {...gridLine} />
        <XAxis dataKey="shortLabel" interval={0} tick={{ ...axisTick, fontSize: 10 }} tickLine={false} axisLine={axisLine} />
        <YAxis width={28} allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
        <Tooltip {...tooltipStyles} cursor={{ fill: 'var(--color-hover)' }} />
        <Bar dataKey="count" name="Eventos" radius={[3, 3, 0, 0]} isAnimationActive={animate} {...chartAnimation}>
          {data.map(row => <Cell key={row.id} fill={confidenceColors[row.id]} />)}
          <LabelList dataKey="count" position="top" fill={chartColors.inkMuted} fontSize={11} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
}
