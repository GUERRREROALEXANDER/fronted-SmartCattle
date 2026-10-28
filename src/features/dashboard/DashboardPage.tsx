import { useEffect, useState } from 'react'
import { ErrorState, GlassCard, Notice, Skeleton } from '../../components/ui'
import { hasPicture } from '../../services'
import { FadeUp, staggerDelay } from '../../motion'
import { AlertStrip } from './AlertStrip'
import { farmCondition, recentAlerts, statusHeadline } from './dashboardModel'
import { FarmStatusHeader } from './FarmStatusHeader'
import { FieldLog } from './FieldLog'
import { HerdSummary } from './HerdSummary'
import { LiveMonitor } from './LiveMonitor'
import { useDashboardData } from './useDashboardData'
import styles from './DashboardPage.module.css'

/** Keeps relative times ("hace 5 minutos") fresh without re-fetching. */
function useNow(intervalMs = 30_000) {
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), intervalMs)
    return () => clearInterval(timer)
  }, [intervalMs])
  return now
}

/** Remembers when a polled value last changed identity, i.e. when fresh data arrived. */
function useArrivalTime(marker: unknown): Date | null {
  const [arrival, setArrival] = useState<{ marker: unknown; at: Date | null }>({ marker: null, at: null })
  if (marker !== null && marker !== undefined && marker !== arrival.marker) setArrival({ marker, at: new Date() })
  return arrival.at
}

const areas = { metrics: styles.metrics, plan: styles.plan, trend: styles.trend, zones: styles.zones }

export function DashboardPage() {
  const data = useDashboardData()
  const now = useNow()
  const events = data.events.data ?? []
  const alerts = recentAlerts(events, now)
  const eventsReady = data.events.status !== 'loading'
  const cameras = data.cameras.data ?? null
  const backendOffline = data.status.data?.backend === 'offline'
  const updatedAt = useArrivalTime(data.events.data)
  // Stale or missing events cannot prove the farm is calm.
  const hasFreshEvents = data.events.status === 'success' && !backendOffline
  const condition = farmCondition(alerts, hasFreshEvents)
  const videoIds = data.snapshots.data
    ? new Set(Object.entries(data.snapshots.data).filter(([, snapshot]) => hasPicture(snapshot.stream)).map(([id]) => id))
    : undefined

  return <div className={styles.page}>
    <FadeUp>
      <FarmStatusHeader
        farmName={data.farm.data?.name ?? null}
        condition={condition}
        headline={eventsReady ? statusHeadline(condition, alerts.length) : null}
        status={data.status.data ?? null}
        cameras={cameras}
        withVideo={videoIds ? videoIds.size : null}
        updatedAt={updatedAt} />
    </FadeUp>

    {(backendOffline || alerts.length > 0) && <FadeUp delay={staggerDelay(1)} className={styles.alerts}>
      {backendOffline && <Notice tone="critical" title="Sin conexión con el servidor">
        Se muestra la última información recibida. Se reintenta automáticamente cada 15 segundos.
      </Notice>}
      <AlertStrip alerts={alerts} cameras={cameras} now={now} />
    </FadeUp>}

    <div className={styles.grid}>
      {data.plan.status === 'loading' && <GlassCard padding="md" className={styles.plan}>
        <Skeleton height="26rem" radius="var(--radius-lg)" />
      </GlassCard>}
      {data.plan.data && <LiveMonitor plan={data.plan.data} cameras={cameras} alerts={alerts}
        stale={backendOffline} withVideo={videoIds} areas={areas} />}
      {data.plan.status === 'success' && !data.plan.data && <GlassCard padding="md" className={styles.plan}>
        <ErrorState
          title="Plano no disponible"
          description="El servidor todavía no ofrece la geometría de la finca ni la ubicación de las cámaras." />
      </GlassCard>}
      <HerdSummary card className={styles.herd} delay={staggerDelay(6)}
        registered={data.registered} detected={data.detected} stale={backendOffline} />
      <FieldLog className={styles.log} delay={staggerDelay(7)}
        events={data.events} cameras={cameras} securityHours={data.securityHours.data ?? null} now={now} />
    </div>
  </div>
}
