import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'
import { VideoAnalyzer } from './analysis/VideoAnalyzer'
import { formatBytes, formatDuration, videoResolution } from './videosModel'
import type { VideoItem } from './videosModel'
import styles from './VideoPlayer.module.css'

export interface VideoPlayerProps {
  video: VideoItem
  onClose: () => void
}

/** Selected video with the simulated detection analyzer; shown inline above the library. */
export function VideoPlayer({ video, onClose }: VideoPlayerProps) {
  const headingId = useId()
  const sectionRef = useRef<HTMLElement>(null)
  const resolution = videoResolution(video.width, video.height)

  useEffect(() => {
    const section = sectionRef.current
    if (!section) return
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    section.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'start' })
  }, [video.id])

  return (
    <section ref={sectionRef} className={styles.panel} aria-labelledby={headingId}>
      <div className={styles.header}>
        <div className={styles.title}>
          <p className={styles.eyebrow}>Análisis con IA · simulación</p>
          <h2 id={headingId} className={styles.name}>{video.fileName}</h2>
          <p className={styles.meta}>
            {formatBytes(video.size)}
            {resolution && <span className={styles.dot} aria-hidden="true" />}
            {resolution}
            {video.duration != null && video.duration > 0 && <span className={styles.dot} aria-hidden="true" />}
            {video.duration != null && video.duration > 0 && formatDuration(video.duration)}
          </p>
        </div>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Cerrar video">
          <X size={22} strokeWidth={1.75} aria-hidden="true" />
        </button>
      </div>
      <VideoAnalyzer key={video.id} video={video} labelledBy={headingId} />
    </section>
  )
}
