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
  /** Number of cameras that deliver a picture; null while unknown. */
  withVideo: number | null
}

export function FarmStatusHeader({ farmName, condition, headline, status, cameras, withVideo }: FarmStatusHeaderProps) {
  const offline = status?.backend === 'offline'
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
      <SystemItem>{camerasPill(cameras, offline, withVideo)}</SystemItem>
    </ul>
  </header>
}

function SystemItem({ children }: { children: ReactNode }) {
  return <li>{children}</li>
}

function backendPill(status: SystemStatus | null) {
  if (!status) return <StatusPill tone="inactive" label="Servidor: comprobando" />
  if (status.backend === 'online') return <StatusPill tone="safe" label="Servidor en línea" />
  if (status.backend === 'offline') return <StatusPill tone="critical" label="Servidor sin conexión" />
  return <StatusPill tone="inactive" label="Servidor: modo demostración" />
}

function aiPill(status: SystemStatus | null) {
  // The API only reports whether an AI URL is configured, not whether the service is up.
  if (!status || status.backend === 'not-checked' || status.aiConfigured === null) return <StatusPill tone="inactive" label="Visión: sin datos" />
  return status.aiConfigured
    ? <StatusPill tone="safe" label="Visión configurada" />
    : <StatusPill tone="warning" label="Visión sin configurar" />
}

function camerasPill(cameras: Camera[] | null, offline: boolean, withVideo: number | null) {
  // With the server offline the camera states are only the last known ones.
  if (!cameras || offline) return <StatusPill tone="inactive" label="Cámaras: sin datos" />
  const online = onlineCameraCount(cameras)
  const video = withVideo === null ? '' : ` · ${withVideo} con video`
  const tone = online === 0 ? 'critical' : online < cameras.length || (withVideo !== null && withVideo < online) ? 'warning' : 'safe'
  return <StatusPill tone={tone} label={`Cámaras ${online}/${cameras.length} conectadas${video}`} />
}
