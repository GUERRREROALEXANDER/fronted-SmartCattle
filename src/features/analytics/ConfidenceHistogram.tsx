import { useId } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, LabelList, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { ConfidenceShare } from './analyticsModel'
import { ChartTooltip } from './ChartTooltip'
import { axisTick, chartAnimation, chartColors, confidenceColors, gridLine, tooltipWrapper, useChartAnimation } from './chartTheme'
import styles from './ConfidenceHistogram.module.css'

export function ConfidenceHistogram({ data }: { data: ConfidenceShare[] }) {
  const animate = useChartAnimation()
  const gradientId = `confidence-${useId().replace(/:/g, '')}`
  return <div className={styles.chart} aria-hidden="true">
    <ResponsiveContainer width="100%" height="100%">
      <BarChart data={data} margin={{ top: 24, right: 4, bottom: 0, left: 0 }}>
        <defs>
          {data.map(row => <linearGradient key={row.id} id={`${gradientId}-${row.id}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={confidenceColors[row.id]} stopOpacity={0.95} />
            <stop offset="100%" stopColor={confidenceColors[row.id]} stopOpacity={0.45} />
          </linearGradient>)}
        </defs>
        <CartesianGrid {...gridLine} />
        <XAxis dataKey="shortLabel" interval={0} tick={{ ...axisTick, fontSize: 10 }} tickLine={false} axisLine={false} />
        <YAxis width={28} allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ fill: 'var(--color-hover)', radius: 10 }} wrapperStyle={tooltipWrapper} />
        <Bar dataKey="count" name="Eventos" radius={[10, 10, 4, 4]} maxBarSize={48} isAnimationActive={animate} {...chartAnimation}>
          {data.map(row => <Cell key={row.id} fill={`url(#${gradientId}-${row.id})`} stroke={confidenceColors[row.id]} strokeWidth={0} />)}
          <LabelList dataKey="count" position="top" fill={chartColors.inkMuted} fontSize={11} fontWeight={600} />
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  </div>
}
