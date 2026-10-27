import { Area, AreaChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { categoryLabels, type DailyShare } from './analyticsModel'
import { axisLine, axisTick, categoryColors, categoryFills, chartAnimation, chartColors, gridLine, tooltipStyles, useChartAnimation } from './chartTheme'
import styles from './DailyTrend.module.css'

const categories = ['cattle', 'security', 'system'] as const

export function DailyTrend({ data }: { data: DailyShare[] }) {
  const animate = useChartAnimation()
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
          <CartesianGrid {...gridLine} />
          <XAxis dataKey="label" minTickGap={30} tick={axisTick} tickLine={false} axisLine={axisLine} />
          <YAxis width={30} allowDecimals={false} tick={axisTick} tickLine={false} axisLine={false} />
          <Tooltip {...tooltipStyles} cursor={{ stroke: chartColors.ruleStrong }} />
          {categories.map(category => <Area key={category} type="linear" dataKey={category}
            name={categoryLabels[category]} stackId="events" stroke={categoryColors[category]}
            fill={categoryFills[category]} fillOpacity={0.95} strokeWidth={2}
            isAnimationActive={animate} {...chartAnimation} />)}
        </AreaChart>
      </ResponsiveContainer>
    </div>
  </div>
}
