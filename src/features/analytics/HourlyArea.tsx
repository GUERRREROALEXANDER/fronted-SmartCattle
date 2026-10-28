import { useId } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { HourShare } from './analyticsModel'
import { ChartTooltip } from './ChartTooltip'
import { axisTick, chartAnimation, chartColors, gridLine, tooltipWrapper, useChartAnimation } from './chartTheme'
import styles from './HourlyArea.module.css'

export function HourlyArea({ data }: { data: HourShare[] }) {
  const animate = useChartAnimation()
  const gradientId = `hourly-${useId().replace(/:/g, '')}`
  return <div className={styles.chart} aria-hidden="true">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
        <defs>
          <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={chartColors.brand} stopOpacity={0.36} />
            <stop offset="100%" stopColor={chartColors.mint} stopOpacity={0.02} />
          </linearGradient>
        </defs>
        <CartesianGrid {...gridLine} />
        <XAxis dataKey="label" interval={3} tick={axisTick} tickLine={false} axisLine={false} />
        <YAxis width={30} allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
        <Tooltip content={<ChartTooltip />} cursor={{ stroke: chartColors.ruleStrong, strokeDasharray: '3 4' }} wrapperStyle={tooltipWrapper} />
        <Area type="monotone" dataKey="count" name="Eventos" stroke={chartColors.brand}
          fill={`url(#${gradientId})`} strokeWidth={2.75} dot={false}
          activeDot={{ r: 4.5, fill: chartColors.brand, stroke: chartColors.surface, strokeWidth: 2 }}
          isAnimationActive={animate} {...chartAnimation} />
      </AreaChart>
    </ResponsiveContainer>
  </div>
}
