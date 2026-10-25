import { useReducedMotion } from 'motion/react'
import type { EventCategory, Severity } from '../../types/domain'
import type { ConfidenceBucketId } from './analyticsModel'

export const chartColors = {
  brand: 'var(--color-brand)',
  earth: 'var(--color-earth)',
  sage: 'var(--color-sage)',
  warning: 'var(--color-warning)',
  critical: 'var(--color-critical)',
  safe: 'var(--color-safe)',
  inactive: 'var(--color-inactive)',
  rule: 'var(--color-rule)',
  ruleStrong: 'var(--color-rule-strong)',
  surface: 'var(--color-surface-raised)',
  ink: 'var(--color-ink)',
  inkMuted: 'var(--color-ink-muted)',
  inkSubtle: 'var(--color-ink-subtle)',
}

export const categoryColors: Record<EventCategory, string> = {
  cattle: chartColors.brand,
  security: chartColors.earth,
  system: chartColors.inactive,
}

export const severityColors: Record<Severity, string> = {
  info: chartColors.sage,
  warning: chartColors.warning,
  critical: chartColors.critical,
}

export const confidenceColors: Record<ConfidenceBucketId, string> = {
  under50: chartColors.inactive,
  '50to70': chartColors.sage,
  '70to85': chartColors.brand,
  '85to100': chartColors.safe,
  unknown: chartColors.ruleStrong,
}

export const axisTick = {
  fill: chartColors.inkSubtle,
  fontFamily: 'var(--font-sans)',
  fontSize: 11,
}

export const axisLine = { stroke: chartColors.ruleStrong }
export const gridLine = { stroke: chartColors.rule, strokeDasharray: '3 5', vertical: false }
export const chartAnimation = { animationDuration: 320, animationEasing: 'ease-out' } as const

export const tooltipStyles = {
  contentStyle: {
    backgroundColor: chartColors.surface,
    border: `1px solid ${chartColors.ruleStrong}`,
    borderRadius: 'var(--radius-md)',
    boxShadow: 'var(--shadow-raised)',
    color: chartColors.ink,
    fontFamily: 'var(--font-sans)',
    fontSize: 'var(--text-sm)',
  },
  itemStyle: { color: chartColors.inkMuted },
  labelStyle: { color: chartColors.ink, fontWeight: 600 },
  wrapperStyle: { outline: 'none' },
}

export function useChartAnimation(): boolean {
  return !useReducedMotion()
}
