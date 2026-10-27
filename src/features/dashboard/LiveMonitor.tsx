import type { FarmPlan as FarmPlanData } from '../../services'
import type { Camera, FarmEvent } from '../../types/domain'
import { FarmPlan } from './FarmPlan'
import { LiveCharts } from './LiveCharts'
import { LiveMetrics } from './LiveMetrics'
import { useLiveHerd } from './useLiveHerd'

/** Live herd monitor: one simulation feeds the animated plan, the metric tiles and the charts. */
export function LiveMonitor({ plan, cameras, alerts, stale, withVideo }: {
  plan: FarmPlanData
  cameras: Camera[] | null
  alerts: FarmEvent[]
  stale: boolean
  withVideo?: ReadonlySet<string>
}) {
  const live = useLiveHerd(plan)
  return <>
    <FarmPlan plan={plan} live={live} cameras={cameras} alerts={alerts} stale={stale} withVideo={withVideo} />
    <LiveMetrics snapshot={live.snapshot} baseline={live.baseline} />
    <LiveCharts snapshot={live.snapshot} points={live.points} />
  </>
}
