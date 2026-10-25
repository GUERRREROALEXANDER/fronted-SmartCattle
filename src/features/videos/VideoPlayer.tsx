import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { formatBytes, formatDuration, videoResolution } from './videosModel'
import type { VideoItem } from './videosModel'
import styles from './VideoPlayer.module.css'

export interface VideoPlayerProps {
  video: VideoItem
  onClose: () => void
}

export function VideoPlayer({ video, onClose }: VideoPlayerProps) {
  const dialogRef = useRef<HTMLDialogElement>(null)
  const headingId = useId()
  const inline = useMediaQuery('(min-width: 1024px)')

  useEffect(() => {
    const dialog = dialogRef.current
    if (!dialog) return
    if (!inline && !dialog.open) dialog.showModal()
    if (inline && dialog.open) dialog.close()
  }, [inline])

  const resolution = videoResolution(video.width, video.height)

  const panel = (
    <div className={styles.panel}>
      <div className={styles.header}>
        <div className={styles.title}>
          <h2 id={headingId} className={styles.name}>{video.fileName}</h2>
          <p className={styles.meta}>
            {formatBytes(video.size)}
            {resolution && <span className={styles.dot} aria-hidden="true" />}
            {resolution}
            {video.duration != null && video.duration > 0 && <span className={styles.dot} aria-hidden="true" />}
            {video.duration != null && video.duration > 0 && formatDuration(video.duration)}
          </p>
        </div>
        {!inline && (
          <button
            type="button"
            className={styles.close}
            onClick={onClose}
            aria-label="Cerrar reproductor"
          >
            <X size={22} strokeWidth={1.75} aria-hidden="true" />
          </button>
        )}
      </div>
      <div className={styles.stage}>
        <video
          src={video.url}
          controls
          autoPlay
          className={styles.video}
          aria-labelledby={headingId}
        />
      </div>
    </div>
  )

  if (inline) {
    return (
      <aside className={styles.inline} aria-labelledby={headingId}>
        {panel}
      </aside>
    )
  }

  return (
    <dialog
      ref={dialogRef}
      className={styles.dialog}
      aria-labelledby={headingId}
      onClose={onClose}
      onClick={event => { if (event.target === dialogRef.current) dialogRef.current?.close() }}
    >
      {panel}
    </dialog>
  )
}
