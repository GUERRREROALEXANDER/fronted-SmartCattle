import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import type { HourShare } from './analyticsModel'
import { axisLine, axisTick, chartAnimation, chartColors, gridLine, tooltipStyles, useChartAnimation } from './chartTheme'
import styles from './HourlyArea.module.css'

export function HourlyArea({ data }: { data: HourShare[] }) {
  const animate = useChartAnimation()
  return <div className={styles.chart} aria-hidden="true">
    <ResponsiveContainer width="100%" height="100%">
      <AreaChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
        <CartesianGrid {...gridLine} />
        <XAxis dataKey="label" interval={3} tick={axisTick} tickLine={false} axisLine={axisLine} />
        <YAxis width={30} allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
        <Tooltip {...tooltipStyles} cursor={{ stroke: chartColors.ruleStrong }} />
        <Area type="monotone" dataKey="count" name="Eventos" stroke={chartColors.brand}
          fill={chartColors.mint} fillOpacity={0.9} strokeWidth={2.5} dot={false}
          activeDot={{ r: 4, fill: chartColors.brand, stroke: chartColors.surface }}
          isAnimationActive={animate} {...chartAnimation} />
      </AreaChart>
    </ResponsiveContainer>
  </div>
}
