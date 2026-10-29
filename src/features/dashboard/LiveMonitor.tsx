import { Suspense, lazy } from 'react'
import type { FarmPlan as FarmPlanData } from '../../services'
import type { Camera, FarmEvent } from '../../types/domain'
import { GlassCard, SkeletonText } from '../../components/ui'
import { staggerDelay } from '../../motion'
import { FarmPlan } from './FarmPlan'
import { LiveMetrics } from './LiveMetrics'
import { useLiveHerd } from './useLiveHerd'

// recharts is the single heaviest dependency in the dashboard, and the
// dashboard is imported eagerly by the router, which put the whole charting
// library in the bundle the login screen downloads. Deferring it here keeps
// the page shell, the metric tiles and the farm plan in the first paint.
const LiveCharts = lazy(async () => ({ default: (await import('./LiveCharts')).LiveCharts }))

export interface LiveMonitorAreas {
  metrics?: string
  plan?: string
  trend?: string
  zones?: string
}

/** Live herd monitor: one simulation feeds the animated plan, the metric tiles and the charts. */
export function LiveMonitor({ plan, cameras, alerts, stale, withVideo, areas = {} }: {
  plan: FarmPlanData
  cameras: Camera[] | null
  alerts: FarmEvent[]
  stale: boolean
  withVideo?: ReadonlySet<string>
  /** Grid-area classes so each card can sit in its own slot of the page grid. */
  areas?: LiveMonitorAreas
}) {
  const live = useLiveHerd(plan)
  return <>
    <LiveMetrics className={areas.metrics} snapshot={live.snapshot} baseline={live.baseline} staggerFrom={1} />
    <FarmPlan className={areas.plan} delay={staggerDelay(5)} plan={plan} live={live} cameras={cameras} alerts={alerts}
      stale={stale} withVideo={withVideo} />
    <Suspense fallback={<LiveChartsPlaceholder trendClassName={areas.trend} zonesClassName={areas.zones} />}>
      <LiveCharts trendClassName={areas.trend} zonesClassName={areas.zones} staggerFrom={7}
        snapshot={live.snapshot} points={live.points} />
    </Suspense>
  </>
}

/** Holds the two chart slots in the grid while recharts loads, so nothing shifts. */
function LiveChartsPlaceholder({ trendClassName, zonesClassName }: {
  trendClassName?: string
  zonesClassName?: string
}) {
  return <>
    <GlassCard className={trendClassName} aria-busy="true"><SkeletonText lines={5} /></GlassCard>
    <GlassCard className={zonesClassName} aria-busy="true"><SkeletonText lines={5} /></GlassCard>
  </>
}
