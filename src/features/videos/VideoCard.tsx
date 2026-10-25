import { useEffect, useRef, useState } from 'react'
import { Play, Trash2 } from 'lucide-react'
import { motion } from 'motion/react'
import { StaggerItem } from '../../motion'
import type { Camera } from '../../types/domain'
import { formatBytes, formatDuration, videoResolution } from './videosModel'
import type { VideoItem } from './videosModel'
import styles from './VideoCard.module.css'

export interface VideoCardProps {
  video: VideoItem
  index: number
  cameras: Camera[] | null
  selected: boolean
  onSelect: (id: string) => void
  onRemove: (id: string) => void
  onAssignCamera: (id: string, cameraId: string | null) => void
}

export function VideoCard({ video, index, cameras, selected, onSelect, onRemove, onAssignCamera }: VideoCardProps) {
  const [confirming, setConfirming] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const resolution = videoResolution(video.width, video.height)

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  const askRemove = () => {
    if (confirming) {
      onRemove(video.id)
      return
    }
    setConfirming(true)
    timerRef.current = setTimeout(() => setConfirming(false), 3000)
  }

  const handleSelectChange = (event: React.ChangeEvent<HTMLSelectElement>) => {
    const value = event.target.value
    onAssignCamera(video.id, value === '' ? null : value)
  }

  return (
    <StaggerItem index={index} className={styles.item}>
      <motion.div
        layout
        className={`${styles.card} ${selected ? styles.selected : ''} ${video.status === 'error' ? styles.error : ''}`}
        onClick={() => onSelect(video.id)}
      >
        <button
          type="button"
          className={styles.thumbnail}
          onClick={event => {
            event.stopPropagation()
            onSelect(video.id)
          }}
          aria-label={`Reproducir ${video.fileName}`}
        >
          {video.thumbnail ? (
            <img src={video.thumbnail} alt="" loading="lazy" />
          ) : (
            <div className={styles.placeholder}>
              <Play size={28} strokeWidth={1.5} aria-hidden="true" />
            </div>
          )}
          {video.duration != null && video.duration > 0 && (
            <span className={styles.badge}>{formatDuration(video.duration)}</span>
          )}
        </button>

        <div className={styles.body}>
          <p className={styles.name} title={video.fileName}>
            {video.fileName}
          </p>
          <p className={styles.meta}>
            {formatBytes(video.size)}
            {resolution && <span className={styles.dot} aria-hidden="true" />}
            {resolution}
          </p>
          {video.status === 'reading' && <p className={styles.meta}>Leyendo video…</p>}
          {video.status === 'error' && <p className={styles.meta}>Este navegador no pudo leer el video.</p>}

          <div className={styles.footer}>
            <select
              className={styles.select}
              value={video.cameraId ?? ''}
              onChange={handleSelectChange}
              onClick={event => event.stopPropagation()}
              aria-label="Asignar cámara"
            >
              <option value="">Sin cámara</option>
              {cameras?.map(camera => (
                <option key={camera.id} value={camera.id}>
                  {camera.name}
                </option>
              ))}
            </select>

            <button
              type="button"
              className={`${styles.remove} ${confirming ? styles.confirm : ''}`}
              onClick={event => {
                event.stopPropagation()
                askRemove()
              }}
              aria-label={confirming ? 'Presiona de nuevo para eliminar' : 'Eliminar video'}
              title={confirming ? 'Presiona de nuevo para eliminar' : 'Eliminar video'}
            >
              <Trash2 size={18} strokeWidth={1.75} aria-hidden="true" />
              <span>{confirming ? '¿Seguro?' : ''}</span>
            </button>
          </div>
        </div>
      </motion.div>
    </StaggerItem>
  )
}
