import { useReducedMotion } from 'motion/react'
import type { EventCategory, Severity } from '../../types/domain'
import type { ConfidenceBucketId } from './analyticsModel'

// "Pradera viva": vivid strokes for lines, bars and slices; pastel companions only as fills.
export const chartColors = {
  brand: 'var(--color-brand)',
  brandStrong: 'var(--color-brand-strong)',
  fresh: 'var(--color-sage)',
  info: 'var(--color-info)',
  warning: 'var(--color-warning)',
  critical: 'var(--color-alarm)',
  safe: 'var(--color-safe)',
  inactive: 'var(--color-inactive)',
  lilac: 'var(--color-lilac-ink)',
  mint: 'var(--color-mint)',
  sky: 'var(--color-sky)',
  butter: 'var(--color-butter)',
  peach: 'var(--color-peach)',
  lilacSoft: 'var(--color-lilac)',
  rule: 'var(--color-rule)',
  ruleStrong: 'var(--color-rule-strong)',
  surface: 'var(--color-surface-raised)',
  ink: 'var(--color-ink)',
  inkMuted: 'var(--color-ink-muted)',
  inkSubtle: 'var(--color-ink-subtle)',
}

export const categoryColors: Record<EventCategory, string> = {
  cattle: chartColors.brand,
  security: chartColors.info,
  system: chartColors.lilac,
}

export const categoryFills: Record<EventCategory, string> = {
  cattle: chartColors.mint,
  security: chartColors.sky,
  system: chartColors.lilacSoft,
}

export const severityColors: Record<Severity, string> = {
  info: chartColors.info,
  warning: chartColors.warning,
  critical: chartColors.critical,
}

export const confidenceColors: Record<ConfidenceBucketId, string> = {
  under50: chartColors.warning,
  '50to70': chartColors.fresh,
  '70to85': chartColors.brand,
  '85to100': chartColors.brandStrong,
  unknown: chartColors.inactive,
}

export const axisTick = {
  fill: chartColors.inkSubtle,
  fontFamily: 'var(--font-sans)',
  fontSize: 11,
}

export const axisLine = { stroke: chartColors.ruleStrong }
export const gridLine = { stroke: chartColors.rule, strokeDasharray: '3 5', vertical: false }
// Entrance and range changes share one ease-out tween inside the 600-900 ms band.
export const chartAnimation = { animationBegin: 0, animationDuration: 800, animationEasing: 'ease-out' } as const

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
