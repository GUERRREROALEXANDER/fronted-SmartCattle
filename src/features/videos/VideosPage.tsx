import { AnimatePresence } from 'motion/react'
import { Clapperboard } from 'lucide-react'
import { EmptyState, PageHeader } from '../../components/ui'
import { useMediaQuery } from '../../lib/useMediaQuery'
import { useResource } from '../../lib/useResource'
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
  const desktop = useMediaQuery('(min-width: 1024px)')

  const readyCount = videos.filter(video => video.status === 'ready').length
  const readingCount = videos.filter(video => video.status === 'reading').length
  const summary = videos.length > 0
    ? `${videos.length} ${videos.length === 1 ? 'video' : 'videos'}${readyCount > 0 ? ` · ${readyCount} listo${readyCount === 1 ? '' : 's'}` : ''}${readingCount > 0 ? ` · ${readingCount} cargando` : ''}`
    : null

  return (
    <div className={styles.page}>
      <PageHeader title="Videos" actions={summary && <p className={styles.summary}>{summary}</p>} />

      <div className={styles.notice}>
        <AnalysisNotice />
      </div>

      <VideoDropzone onAdd={addFiles} />

      {videos.length === 0 && (
        <EmptyState
          icon={Clapperboard}
          title="No hay videos cargados"
          description="Arrastra grabaciones de las cámaras o presiona Elegir videos para revisarlas aquí."
        />
      )}

      <div className={styles.layout}>
        {videos.length > 0 && (
          <section className={styles.grid} aria-label="Videos cargados">
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
          </section>
        )}

        {desktop && selected && (
          <VideoPlayer video={selected} onClose={() => select(null)} />
        )}
      </div>

      {!desktop && selected && (
        <VideoPlayer video={selected} onClose={() => select(null)} />
      )}
    </div>
  )
}
