import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Clapperboard } from 'lucide-react'
import { EmptyState, PageHeader } from '../../components/ui'
import { useResource } from '../../lib/useResource'
import { duration, ease, FadeUp, staggerDelay } from '../../motion'
import { listCameras } from '../../services'
import { AnalysisNotice } from './AnalysisNotice'
import { VideoCard } from './VideoCard'
import { VideoDropzone } from './VideoDropzone'
import { VideoPlayer } from './VideoPlayer'
import { useVideoLibraryContext } from './useVideoLibraryContext'
import styles from './VideosPage.module.css'

export function VideosPage() {
  const { videos, selected, addFiles, remove, assignCamera, select } = useVideoLibraryContext()
  const cameras = useResource(signal => listCameras({ signal }), { refreshMs: 60_000 })
  const reduce = useReducedMotion()

  const readyCount = videos.filter(video => video.status === 'ready').length
  const readingCount = videos.filter(video => video.status === 'reading').length
  const summary = videos.length > 0
    ? `${videos.length} ${videos.length === 1 ? 'video' : 'videos'}${readyCount > 0 ? ` · ${readyCount} listo${readyCount === 1 ? '' : 's'}` : ''}${readingCount > 0 ? ` · ${readingCount} cargando` : ''}`
    : null
  const swap = {
    initial: { opacity: 0, y: reduce ? 0 : 12 },
    animate: { opacity: 1, y: 0 },
    exit: { opacity: 0 },
    transition: { duration: reduce ? duration.micro : duration.panel, ease: ease.out },
  }

  return (
    <div className={styles.page}>
      <FadeUp className={styles.head}>
        <PageHeader title="Videos" actions={summary && <p className={styles.summary}>{summary}</p>} />
        <p className={styles.lead}>Sube grabaciones de las cámaras y analízalas con la detección simulada, sin salir del navegador.</p>
      </FadeUp>

      <AnimatePresence mode="wait" initial={false}>
        {selected ? (
          <motion.div key={`player-${selected.id}`} {...swap}>
            <VideoPlayer video={selected} onClose={() => select(null)} />
          </motion.div>
        ) : (
          <motion.div key="intro" {...swap}>
            <FadeUp delay={staggerDelay(1)}>
              <AnalysisNotice onSampleReady={file => void addFiles([file], { select: true })} />
            </FadeUp>
          </motion.div>
        )}
      </AnimatePresence>

      <FadeUp delay={staggerDelay(2)}>
        <VideoDropzone onAdd={addFiles} />
      </FadeUp>

      {videos.length === 0 && (
        <FadeUp delay={staggerDelay(3)} className={styles.emptyCard}>
          <EmptyState
            icon={Clapperboard}
            title="No hay videos cargados"
            description="Arrastra grabaciones de las cámaras o presiona Elegir videos. Luego elige un video para analizarlo."
          />
        </FadeUp>
      )}

      {videos.length > 0 && (
        <section className={styles.library} aria-labelledby="videos-library-title">
          <div className={styles.libraryHead}>
            <h2 id="videos-library-title" className={styles.libraryTitle}>Biblioteca</h2>
            <p className={styles.libraryHint}>Elige un video para analizarlo o asígnalo a una cámara.</p>
          </div>
          <div className={styles.grid}>
            <AnimatePresence mode="popLayout">
              {videos.map((video, index) => (
                <VideoCard
                  key={video.id}
                  video={video}
                  index={index}
                  cameras={cameras.data ?? null}
                  selected={selected?.id === video.id}
                  onSelect={select}
                  onRemove={remove}
                  onAssignCamera={assignCamera}
                />
              ))}
            </AnimatePresence>
          </div>
        </section>
      )}
    </div>
  )
}
