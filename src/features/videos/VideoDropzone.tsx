import { useRef, useState } from 'react'
import { Upload } from 'lucide-react'
import { Button, Notice } from '../../components/ui'
import { validateVideoFile } from './videosModel'
import styles from './VideoDropzone.module.css'

interface RejectedFile {
  id: string
  fileName: string
  reason: string
}

export interface VideoDropzoneProps {
  onAdd: (files: File[]) => void
}

export function VideoDropzone({ onAdd }: VideoDropzoneProps) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragOver, setDragOver] = useState(false)
  const [rejected, setRejected] = useState<RejectedFile[]>([])

  const handleFiles = (files: FileList | null) => {
    if (!files) return
    const accepted: File[] = []
    const nextRejected: RejectedFile[] = []

    for (const file of Array.from(files)) {
      const result = validateVideoFile(file)
      if (result.ok) {
        accepted.push(file)
      } else {
        nextRejected.push({ id: crypto.randomUUID(), fileName: file.name, reason: result.reason ?? 'No se pudo agregar.' })
      }
    }

    if (nextRejected.length > 0) {
      setRejected(current => [...nextRejected, ...current].slice(0, 4))
    }
    if (accepted.length > 0) {
      onAdd(accepted)
    }
  }

  const openInput = () => inputRef.current?.click()

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(true)
  }

  const onDragLeave = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
  }

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault()
    setDragOver(false)
    handleFiles(event.dataTransfer.files)
  }

  const dismiss = (id: string) => {
    setRejected(current => current.filter(item => item.id !== id))
  }

  return (
    <div className={styles.stack}>
      <div
        className={`${styles.zone} ${dragOver ? styles.dragging : ''}`}
        onDragOver={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        onClick={openInput}
      >
        {/* Dashed outline drawn in SVG so it can march while a file is dragged over. */}
        <svg className={styles.outline} aria-hidden="true" focusable="false"><rect className={styles.outlineRect} /></svg>
        <span className={styles.iconBadge} aria-hidden="true"><Upload className={styles.icon} size={28} strokeWidth={1.75} /></span>
        <p className={styles.title}>Arrastra videos de las cámaras aquí</p>
        <p className={styles.hint}>MP4, WebM, QuickTime, Matroska. Máximo 1 GB cada uno.</p>
        <Button
          type="button"
          variant="secondary"
          icon={Upload}
          className={styles.button}
          onClick={event => {
            event.stopPropagation()
            openInput()
          }}
        >
          Elegir videos
        </Button>
        <input
          ref={inputRef}
          type="file"
          accept="video/*"
          multiple
          className={styles.input}
          onChange={event => {
            handleFiles(event.target.files)
            event.target.value = ''
          }}
        />
      </div>

      {rejected.length > 0 && (
        <div className={styles.rejects}>
          {rejected.map(item => (
            <Notice
              key={item.id}
              tone="warning"
              title={item.fileName}
              action={
                <button
                  type="button"
                  className={styles.dismiss}
                  onClick={() => dismiss(item.id)}
                  aria-label="Cerrar aviso"
                >
                  ×
                </button>
              }
            >
              {item.reason}
            </Notice>
          ))}
        </div>
      )}
    </div>
  )
}
