import { useId } from 'react'
import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { categoryLabels, type DailyShare } from './analyticsModel'
import { ChartTooltip } from './ChartTooltip'
import { axisTick, categoryColors, chartAnimation, chartColors, gridLine, tooltipWrapper, useChartAnimation } from './chartTheme'
import styles from './DailyTrend.module.css'

const categories = ['cattle', 'security', 'system'] as const

export function DailyTrend({ data }: { data: DailyShare[] }) {
  const animate = useChartAnimation()
  const gradientId = `daily-${useId().replace(/:/g, '')}`
  return <div className={styles.root} aria-hidden="true">
    <ul className={styles.legend}>
      {categories.map(category => <li key={category}>
        <span style={{ backgroundColor: categoryColors[category] }} />
        {categoryLabels[category]}
      </li>)}
    </ul>
    <div className={styles.chart}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={data} margin={{ top: 12, right: 8, bottom: 0, left: 0 }}>
          <defs>
            {categories.map(category => <linearGradient key={category} id={`${gradientId}-${category}`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor={categoryColors[category]} stopOpacity={0.4} />
              <stop offset="100%" stopColor={categoryColors[category]} stopOpacity={0.04} />
            </linearGradient>)}
          </defs>
          <CartesianGrid {...gridLine} />
          <XAxis dataKey="label" minTickGap={30} tick={axisTick} tickLine={false} axisLine={false} />
          <YAxis width={30} allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
          <Tooltip content={<ChartTooltip />} cursor={{ stroke: chartColors.ruleStrong, strokeDasharray: '3 4' }} wrapperStyle={tooltipWrapper} />
          {categories.map(category => <Area key={category} type="monotone" dataKey={category}
            name={categoryLabels[category]} stackId="events" stroke={categoryColors[category]}
            fill={`url(#${gradientId}-${category})`} strokeWidth={2.25} dot={false}
            activeDot={{ r: 4, fill: categoryColors[category], stroke: chartColors.surface, strokeWidth: 2 }}
            isAnimationActive={animate} {...chartAnimation} />)}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
}
