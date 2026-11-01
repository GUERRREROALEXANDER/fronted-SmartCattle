import { ErrorState, GlassCard, Skeleton } from '../../components/ui'
import { herdCount } from '../../live/liveState'
import { useFarmLive, useHerdMotion } from '../../live/useHerdMotion'
import { staggerDelay } from '../../motion'
import { FarmPlan } from './FarmPlan'
import { LiveCharts } from './LiveCharts'
import { LiveMetrics } from './LiveMetrics'

export interface LiveMonitorAreas {
  metrics?: string
  plan?: string
  trend?: string
  alerts?: string
}

// Plan units (the 800 × 520 drawing): roughly five units per metre, so a cow walks at about 1.4 m/s.
const PLAN_MOTION = {
  toSpace: ({ x, y }: { x: number; y: number }) => ({ x, z: y }),
  cowSpeed: 7,
  personSpeed: 9,
  arriveRadius: 1.5,
}

/**
 * The live half of the dashboard: one tracked herd feeds the animated plan, and the same live state
 * feeds the KPI tiles and the charts, so every number on the page agrees with what the plan shows.
 */
export function LiveMonitor({ stale, withVideo, reduceMotion, areas = {} }: {
  stale: boolean
  withVideo?: ReadonlySet<string>
  reduceMotion: boolean
  /** Grid-area classes so each card can sit in its own slot of the page grid. */
  areas?: LiveMonitorAreas
}) {
  const { live, plan, entities } = useFarmLive()
  const herd = useHerdMotion(plan.data, entities, PLAN_MOTION, reduceMotion)
  const count = herdCount(live)

  return <>
    <LiveMetrics className={areas.metrics} staggerFrom={1} count={count} history={live.history} metrics={live.metrics}
      cameras={live.cameras} alerts={live.alerts} reduceMotion={reduceMotion} />
    {plan.status === 'loading' && <GlassCard padding="md" className={areas.plan}>
      <Skeleton height="26rem" radius="var(--radius-lg)" />
    </GlassCard>}
    {plan.data && <FarmPlan className={areas.plan} delay={staggerDelay(5)} plan={plan.data}
      agents={herd.agents} step={herd.step} reduceMotion={reduceMotion} connection={live.connection}
      cameras={live.cameras} alerts={live.alerts} stale={stale} withVideo={withVideo} />}
    {plan.status !== 'loading' && !plan.data && <GlassCard padding="md" className={areas.plan}>
      <ErrorState
        title="Plano no disponible"
        description="El servidor todavía no reporta lotes ni cámaras para dibujar la finca."
        onRetry={plan.reload} />
    </GlassCard>}
    <LiveCharts trendClassName={areas.trend} alertsClassName={areas.alerts} staggerFrom={7}
      history={live.history} reduceMotion={reduceMotion} />
  </>
}
