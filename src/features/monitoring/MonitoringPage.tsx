import { useEffect, useState } from 'react'
import { useSearchParams } from 'react-router'
import { EventRow } from '../../components/events/EventRow'
import { EmptyState, ErrorState, Notice, PageHeader, StatusPill } from '../../components/ui'
import { useResource } from '../../lib/useResource'
import { getCameraStream, getFrameDetections, getSystemStatus, hasPicture, listCameras, listEvents, listSafeZones, loadCameraSnapshots } from '../../services'
import type { Severity } from '../../types/domain'
import { recentAlerts } from '../dashboard/dashboardModel'
import { CameraStage } from './CameraStage'
import { CameraSwitcher } from './CameraSwitcher'
import type { OverlayLayers } from './DetectionOverlay'
import { LayerToggles } from './LayerToggles'
import { pickCamera } from './monitoringModel'
import styles from './MonitoringPage.module.css'

const liveRefreshMs = 15_000
const frameRefreshMs = 5_000

export function MonitoringPage() {
  const [searchParams] = useSearchParams()
  const [layers, setLayers] = useState<OverlayLayers>({ boxes: true, zones: true, labels: true })
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const cameras = useResource(signal => listCameras({ signal }), { refreshMs: liveRefreshMs })
  const events = useResource(signal => listEvents({ signal }), { refreshMs: liveRefreshMs })
  const status = useResource(signal => getSystemStatus({ signal }), { refreshMs: liveRefreshMs })

  const alerts = recentAlerts(events.data ?? [], now)
  const camera = pickCamera(cameras.data ?? [], searchParams.get('camera'), alerts)
  const cameraId = camera?.id ?? ''
  const stream = useResource(signal => getCameraStream(cameraId, { signal }), { key: cameraId })
  const frame = useResource(signal => getFrameDetections(cameraId, { signal }), { key: cameraId, refreshMs: frameRefreshMs })
  const zones = useResource(signal => listSafeZones(cameraId, { signal }), { key: cameraId })
  const ids = (cameras.data ?? []).map(item => item.id)
  const snapshots = useResource(signal => loadCameraSnapshots(ids, signal), { key: ids.join(','), refreshMs: liveRefreshMs })
  const withVideo = snapshots.data ? new Set(ids.filter(id => hasPicture(snapshots.data?.[id]?.stream))) : undefined

  const alertByCamera = new Map<string, Severity>()
  for (const alert of alerts) if (!alertByCamera.has(alert.cameraId)) alertByCamera.set(alert.cameraId, alert.severity)
  const cameraEvents = (events.data ?? []).filter(event => event.cameraId === cameraId).slice(0, 5)
  const live = stream.data?.kind === 'image' || stream.data?.kind === 'mjpeg'
  const synthetic = stream.data?.kind === 'image' && stream.data.synthetic

  if (cameras.status === 'success' && !cameras.data) {
    return <>
      <PageHeader title="En vivo" />
      <ErrorState title="Cámaras no disponibles"
        description="El servidor todavía no ofrece la lista de cámaras ni sus transmisiones." />
    </>
  }
  if (cameras.status === 'success' && cameras.data?.length === 0) {
    return <>
      <PageHeader title="En vivo" />
      <EmptyState title="Aún no hay cámaras" description="Cuando se registren cámaras de la finca, podrás verlas aquí." />
    </>
  }

  return <div className={styles.page}>
    <PageHeader title="En vivo" />
    {status.data?.backend === 'offline' && <Notice className={styles.notice} tone="critical" title="Sin conexión con el servidor">
      Las alertas y eventos pueden estar desactualizados. Se reintenta automáticamente.
    </Notice>}
    {status.data?.aiConfigured === false && <Notice className={styles.notice} tone="warning" title="Visión artificial sin configurar">
      El servidor no tiene un servicio de visión configurado, así que no habrá detecciones.
    </Notice>}

    <div className={styles.layout}>
      <div className={styles.main}>
        <div className={styles.switcherMobile}>
          {cameras.data && <CameraSwitcher cameras={cameras.data} selectedId={camera?.id ?? null} alertByCamera={alertByCamera} withVideo={withVideo} />}
        </div>
        <CameraStage camera={camera} stream={stream.data} streamLoading={stream.status === 'loading' || cameras.status === 'loading'}
          frame={frame.data} zones={zones.data ?? []} layers={layers}
          aiConfigured={status.data?.aiConfigured ?? null} now={now} />
        {live && <div className={styles.toolbar}>
          <LayerToggles layers={layers} onChange={setLayers} disabled={false} />
          {synthetic && <p className={styles.synthetic}>Imagen ilustrativa con detecciones simuladas</p>}
        </div>}
      </div>

      <aside className={styles.aside}>
        <section className={styles.switcherDesktop} aria-labelledby="cameras-title">
          <h2 id="cameras-title" className={styles.sectionTitle}>Cámaras</h2>
          {cameras.data && <CameraSwitcher cameras={cameras.data} selectedId={camera?.id ?? null} alertByCamera={alertByCamera} withVideo={withVideo} />}
        </section>

        <section aria-labelledby="camera-events-title">
          <h2 id="camera-events-title" className={styles.sectionTitle}>
            Eventos{camera ? ` · ${camera.name}` : ''}
          </h2>
          {events.status === 'error' && !events.data
            ? <ErrorState description="No se pudieron cargar los eventos." onRetry={events.reload} />
            : cameraEvents.length === 0 && events.status === 'success'
              ? <p className={styles.empty}>Sin eventos recientes en esta cámara.</p>
              : <ol className={styles.events}>{cameraEvents.map(event => <EventRow key={event.id} event={event} now={now} />)}</ol>}
        </section>

        <section aria-labelledby="services-title">
          <h2 id="services-title" className={styles.sectionTitle}>Servicios</h2>
          <ul className={styles.services}>
            <li>{!status.data ? <StatusPill tone="inactive" label="Servidor: comprobando" />
              : status.data.backend === 'online' ? <StatusPill tone="safe" label="Servidor en línea" />
                : <StatusPill tone="critical" label="Servidor sin conexión" />}</li>
            <li>{status.data?.aiConfigured === true ? <StatusPill tone="safe" label="Visión configurada" />
              : status.data?.aiConfigured === false ? <StatusPill tone="warning" label="Visión sin configurar" />
                : <StatusPill tone="inactive" label="Visión: sin datos" />}</li>
            <li>{live ? <StatusPill tone={synthetic ? 'info' : 'safe'} label={synthetic ? 'Video: demostración' : 'Video en vivo'} />
              : <StatusPill tone="inactive" label="Video: sin transmisión" />}</li>
          </ul>
        </section>
      </aside>
    </div>
  </div>
}
