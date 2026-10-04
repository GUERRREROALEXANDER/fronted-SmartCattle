import { useEffect, useState } from 'react'
import { ErrorState, Notice, Skeleton } from '../../components/ui'
import { hasPicture } from '../../services'
import { AlertStrip } from './AlertStrip'
import { farmCondition, recentAlerts, statusHeadline } from './dashboardModel'
import { FarmPlan } from './FarmPlan'
import { FarmStatusHeader } from './FarmStatusHeader'
import { FieldLog } from './FieldLog'
import { HerdSummary } from './HerdSummary'
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

export function DashboardPage() {
  const data = useDashboardData()
  const now = useNow()
  const events = data.events.data ?? []
  const alerts = recentAlerts(events, now)
  const eventsReady = data.events.status !== 'loading'
  const cameras = data.cameras.data ?? null
  const backendOffline = data.status.data?.backend === 'offline'
  // Stale or missing events cannot prove the farm is calm.
  const hasFreshEvents = data.events.status === 'success' && !backendOffline
  const condition = farmCondition(alerts, hasFreshEvents)
  const videoIds = data.snapshots.data
    ? new Set(Object.entries(data.snapshots.data).filter(([, snapshot]) => hasPicture(snapshot.stream)).map(([id]) => id))
    : undefined

  return <div className={styles.page}>
    <FarmStatusHeader
      farmName={data.farm.data?.name ?? null}
      condition={condition}
      headline={eventsReady ? statusHeadline(condition, alerts.length) : null}
      status={data.status.data ?? null}
      cameras={cameras}
      withVideo={videoIds ? videoIds.size : null} />

    {backendOffline && <Notice className={styles.notice} tone="critical" title="Sin conexión con el servidor">
      Se muestra la última información recibida. Se reintenta automáticamente cada 15 segundos.
    </Notice>}
    <AlertStrip alerts={alerts} cameras={cameras} now={now} />

    <div className={styles.grid}>
      <div className={styles.main}>
        {data.plan.status === 'loading' && <Skeleton height="22rem" radius="var(--radius-lg)" />}
        {data.plan.data && <FarmPlan plan={data.plan.data} cameras={cameras} alerts={alerts} stale={backendOffline} withVideo={videoIds} />}
        {data.plan.status === 'success' && !data.plan.data && <ErrorState
          title="Plano no disponible"
          description="El servidor todavía no ofrece la geometría de la finca ni la ubicación de las cámaras." />}
      </div>
      <div className={styles.aside}>
        <HerdSummary registered={data.registered} detected={data.detected} stale={backendOffline} />
        <FieldLog events={data.events} cameras={cameras} securityHours={data.securityHours.data ?? null} now={now} />
      </div>
    </div>
  </div>
}
