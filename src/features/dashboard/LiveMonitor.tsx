import type { FarmPlan as FarmPlanData } from '../../services'
import type { Camera, FarmEvent } from '../../types/domain'
import { staggerDelay } from '../../motion'
import { FarmPlan } from './FarmPlan'
import { LiveCharts } from './LiveCharts'
import { LiveMetrics } from './LiveMetrics'
import { useLiveHerd } from './useLiveHerd'

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
    <LiveCharts trendClassName={areas.trend} zonesClassName={areas.zones} staggerFrom={7}
      snapshot={live.snapshot} points={live.points} />
  </>
}
