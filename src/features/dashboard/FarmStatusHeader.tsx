import type { ReactNode } from 'react'
import { StatusPill } from '../../components/ui'
import { Skeleton } from '../../components/ui'
import type { Camera, SystemStatus } from '../../types/domain'
import { onlineCameraCount, type FarmCondition } from './dashboardModel'
import styles from './FarmStatusHeader.module.css'

interface FarmStatusHeaderProps {
  farmName: string | null
  condition: FarmCondition
  headline: string | null
  status: SystemStatus | null
  cameras: Camera[] | null
}

export function FarmStatusHeader({ farmName, condition, headline, status, cameras }: FarmStatusHeaderProps) {
  return <header className={styles.header}>
    <h1 className={styles.headline}>
      <span className={styles.farm}>{farmName ?? 'Tu finca'}</span>
      <span className={styles.separator} aria-hidden="true"> · </span>
      {headline
        ? <span className={styles[condition]}>{headline}</span>
        : <Skeleton width="14ch" height="0.9em" className={styles.skeleton} />}
    </h1>
    <ul className={styles.system} aria-label="Estado del sistema">
      <SystemItem>{backendPill(status)}</SystemItem>
      <SystemItem>{aiPill(status)}</SystemItem>
      <SystemItem>{camerasPill(cameras)}</SystemItem>
    </ul>
  </header>
}

function SystemItem({ children }: { children: ReactNode }) {
  return <li>{children}</li>
}

function backendPill(status: SystemStatus | null) {
  if (!status) return <StatusPill tone="inactive" label="Servidor: comprobando" />
  return status.backend === 'online'
    ? <StatusPill tone="safe" label="Servidor en línea" />
    : <StatusPill tone="critical" label="Servidor sin conexión" />
}

function aiPill(status: SystemStatus | null) {
  // The API only reports whether an AI URL is configured, not whether the service is up.
  if (!status || status.aiConfigured === null) return <StatusPill tone="inactive" label="Visión: sin datos" />
  return status.aiConfigured
    ? <StatusPill tone="safe" label="Visión configurada" />
    : <StatusPill tone="warning" label="Visión sin configurar" />
}

function camerasPill(cameras: Camera[] | null) {
  if (!cameras) return <StatusPill tone="inactive" label="Cámaras: sin datos" />
  const online = onlineCameraCount(cameras)
  const tone = online === cameras.length ? 'safe' : online === 0 ? 'critical' : 'warning'
  return <StatusPill tone={tone} label={`Cámaras ${online}/${cameras.length} en línea`} />
}
