import { Cell, Pie, PieChart, ResponsiveContainer, Tooltip, type PieLabelRenderProps } from 'recharts'
import type { CategoryShare } from './analyticsModel'
import { categoryColors, chartAnimation, chartColors, tooltipStyles, useChartAnimation } from './chartTheme'
import { formatPercentage } from './percent'
import styles from './CategoryDonut.module.css'

function sliceLabel({ x, y, payload }: PieLabelRenderProps) {
  if (payload.percentage < 8) return null
  return <text x={x} y={y} fill={chartColors.ink} textAnchor="middle" dominantBaseline="central"
    fontSize={12} fontWeight={600} stroke={chartColors.surface} strokeWidth={3} paintOrder="stroke">{formatPercentage(payload.percentage)}</text>
}

export function CategoryDonut({ data }: { data: CategoryShare[] }) {
  const animate = useChartAnimation()
  const total = data.reduce((sum, row) => sum + row.count, 0)

  return <div className={styles.root} aria-hidden="true">
    <div className={styles.plot}>
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="label" cx="50%" cy="50%"
            innerRadius="58%" outerRadius="78%" paddingAngle={3} cornerRadius={6} stroke={chartColors.surface}
            strokeWidth={2} label={sliceLabel} labelLine={false}
            isAnimationActive={animate} {...chartAnimation}>
            {data.map(row => <Cell key={row.category} fill={categoryColors[row.category]} />)}
          </Pie>
          <Tooltip {...tooltipStyles} />
        </PieChart>
      </ResponsiveContainer>
      <div className={styles.center}>
        <strong>{total.toLocaleString('es-CO')}</strong>
        <span>eventos</span>
      </div>
    </div>
    <ul className={styles.legend}>
      {data.map(row => <li key={row.category}>
        <span className={styles.swatch} style={{ backgroundColor: categoryColors[row.category] }} />
        <span>{row.label}</span>
        <strong>{formatPercentage(row.percentage)}</strong>
        <small>{row.count} {row.count === 1 ? 'evento' : 'eventos'}</small>
      </li>)}
    </ul>
  </div>
}
