import { useEffect, useState } from 'react'
import { Cctv } from 'lucide-react'
import { useAuth } from '../../app/auth/useAuth'
import { EmptyState, ErrorState, PageHeader, Skeleton } from '../../components/ui'
import { can } from '../../lib/permissions'
import { useResource } from '../../lib/useResource'
import { hasPicture, listCameras, listEvents, loadCameraSnapshots } from '../../services'
import type { Severity } from '../../types/domain'
import { onlineCameraCount, recentAlerts } from '../dashboard/dashboardModel'
import { CameraCard } from './CameraCard'
import styles from './CamerasPage.module.css'

export function CamerasPage() {
  const { session } = useAuth()
  const [now, setNow] = useState(() => new Date())
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  const cameras = useResource(signal => listCameras({ signal }), { refreshMs: 5_000 })
  const events = useResource(signal => listEvents({ signal }), { refreshMs: 15_000 })
  const ids = (cameras.data ?? []).map(camera => camera.id)
  const snapshots = useResource(signal => loadCameraSnapshots(ids, signal), { key: ids.join(','), refreshMs: 15_000 })

  const alertByCamera = new Map<string, Severity>()
  for (const alert of recentAlerts(events.data ?? [], now)) {
    if (!alertByCamera.has(alert.cameraId)) alertByCamera.set(alert.cameraId, alert.severity)
  }

  // Most urgent first: recent alerts, then connection problems, then the rest in their original order.
  const urgency = (id: string, status: string) =>
    alertByCamera.get(id) === 'critical' ? 0 : alertByCamera.has(id) ? 1 : status === 'error' || status === 'offline' ? 2 : 3
  const list = [...(cameras.data ?? [])].sort((a, b) => urgency(a.id, a.status) - urgency(b.id, b.status))
  const online = onlineCameraCount(list)
  const videoCount = snapshots.data ? list.filter(camera => hasPicture(snapshots.data?.[camera.id]?.stream)).length : null
  const summary = cameras.data
    ? `${online} de ${list.length} conectadas · ${videoCount ?? '…'} con video${list.length - online > 0 ? ` · ${list.length - online} sin conexión` : ''}`
    : null

  return <>
    <PageHeader title="Cámaras" actions={summary && <p className={styles.summary}>{summary}</p>} />

    {cameras.status === 'loading' && <div className={styles.grid}>
      {[0, 1, 2, 3].map(index => <Skeleton key={index} height="20rem" radius="var(--radius-lg)" />)}
    </div>}

    {cameras.status === 'error' && !cameras.data && <ErrorState description="No se pudo cargar la lista de cámaras." onRetry={cameras.reload} />}

    {cameras.status === 'success' && !cameras.data && <ErrorState title="Cámaras no disponibles"
      description="El servidor todavía no ofrece la lista de cámaras ni su estado." />}

    {cameras.data && list.length === 0 && <EmptyState icon={Cctv} title="No hay cámaras conectadas"
      description="Enciende la cámara y el servicio de visión en la PC de la finca. Aparecerá aquí sola, con su video." />}

    {list.length > 0 && <div className={styles.grid}>
      {list.map(camera => <CameraCard key={camera.id} camera={camera}
        stream={snapshots.data?.[camera.id]?.stream ?? null}
        frame={snapshots.data?.[camera.id]?.frame ?? null}
        alert={alertByCamera.get(camera.id)} now={now} />)}
    </div>}

    {session && can(session.user.role, 'cameras:configure') && list.length > 0 && <p className={styles.note}>
      Agregar cámaras o cambiar su zona estará disponible cuando el servidor lo permita.
    </p>}
  </>
}
