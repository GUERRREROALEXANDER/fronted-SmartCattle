import type { CSSProperties } from 'react'
import { Loader2, OctagonAlert, VideoOff, WifiOff, type LucideIcon } from 'lucide-react'
import { formatRelative, formatTime } from '../../lib/format'
import type { Camera, FrameDetections, SafeZone, StreamSource } from '../../types/domain'
import { DetectionOverlay, type OverlayLayers } from './DetectionOverlay'
import { detectionSummaryText, stageState, summarizeDetections } from './monitoringModel'
import styles from './CameraStage.module.css'

interface CameraStageProps {
  camera: Camera | null
  stream: StreamSource | null
  streamLoading: boolean
  frame: FrameDetections | null
  zones: readonly SafeZone[]
  layers: OverlayLayers
  aiConfigured: boolean | null
  now: Date
}

const connectionLabel: Record<Camera['status'], string> = {
  online: 'En línea', connecting: 'Conectando', offline: 'Sin conexión', error: 'Con error',
}

export function CameraStage({ camera, stream, streamLoading, frame, zones, layers, aiConfigured, now }: CameraStageProps) {
  const state = stageState(camera, stream, streamLoading)
  const detections = state === 'live' ? frame?.detections ?? [] : []
  const summary = summarizeDetections(detections)
  const media = state === 'live' && stream && (stream.kind === 'image' || stream.kind === 'mjpeg') ? stream : null

  return <section className={styles.stage} aria-label={camera ? `Cámara ${camera.name}` : 'Cámara'}>
    <div className={styles.viewport} style={media ? { aspectRatio: `${media.width} / ${media.height}` } : undefined}>
      {media && <div className={styles.frame} style={{ aspectRatio: `${media.width} / ${media.height}`, '--ar': media.width / media.height } as CSSProperties}>
        {/* MJPEG streams render through <img> as well; both keep the overlay registered to the picture. */}
        <img className={styles.media} src={media.url} alt="" />
        <DetectionOverlay width={media.width} height={media.height} detections={detections} zones={zones} layers={layers} />
      </div>}
      {!media && <StageMessage state={state} camera={camera} now={now} />}

      {camera && <div className={styles.topBar}>
        <div className={styles.identity}>
          <p className={styles.name}>{camera.name}</p>
          <p className={styles.location}>{camera.location}</p>
        </div>
        <p className={`${styles.connection} ${styles[camera.status]}`}>
          <span className={styles.connectionDot} aria-hidden="true" />{connectionLabel[camera.status]}
        </p>
      </div>}

      {state === 'live' && <div className={styles.bottomBar}>
        <p className={styles.counts} aria-live="polite">
          {aiConfigured === false ? 'Visión sin configurar: sin detecciones' : detections.length === 0 ? 'Sin detecciones en esta imagen' : detectionSummaryText(summary)}
        </p>
        {summary.outside > 0 && <p className={styles.outsideChip} role="status">
          <OctagonAlert size={14} strokeWidth={2} aria-hidden="true" />
          {summary.outside === 1 ? '1 fuera de zona' : `${summary.outside} fuera de zona`}
        </p>}
        {frame && <p className={styles.frameTime}>
          <time className="tabular" dateTime={frame.capturedAt.toISOString()}>{formatTime(frame.capturedAt)}</time>
        </p>}
      </div>}
    </div>
  </section>
}

const messages: Partial<Record<ReturnType<typeof stageState>, { icon: LucideIcon; title: string; text: string }>> = {
  offline: { icon: WifiOff, title: 'Cámara sin conexión', text: 'No llega imagen desde esta cámara. Revisa la energía y la red en el lugar.' },
  error: { icon: OctagonAlert, title: 'La cámara reporta un error', text: 'Reinicia la cámara o revisa su configuración.' },
  'no-stream': { icon: VideoOff, title: 'Sin transmisión disponible', text: 'Esta cámara todavía no envía video al sistema. Las detecciones aparecerán aquí cuando llegue la imagen.' },
  unsupported: { icon: VideoOff, title: 'Formato de video no compatible', text: 'Esta transmisión usa un formato que la aplicación aún no reproduce.' },
}

function StageMessage({ state, camera, now }: { state: ReturnType<typeof stageState>; camera: Camera | null; now: Date }) {
  if (state === 'loading' || state === 'connecting') {
    return <div className={styles.message} role="status">
      <Loader2 className={styles.spinner} size={28} strokeWidth={1.75} aria-hidden="true" />
      <p className={styles.messageTitle}>{state === 'connecting' ? 'Conectando con la cámara…' : 'Cargando cámara…'}</p>
    </div>
  }
  const message = messages[state]
  if (!message) return null
  const Icon = message.icon
  return <div className={styles.message}>
    <Icon size={28} strokeWidth={1.5} aria-hidden="true" />
    <p className={styles.messageTitle}>{message.title}</p>
    <p className={styles.messageText}>{message.text}</p>
    {state === 'offline' && camera?.lastSeenAt && <p className={styles.messageText}>Última señal {formatRelative(camera.lastSeenAt, now)}.</p>}
  </div>
}
