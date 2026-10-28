import { useCallback, useEffect, useRef, useState } from 'react'
import type { VideoItem } from './videosModel'
import { readVideoMetadata } from './readVideoMetadata'

export interface VideoLibrary {
  videos: VideoItem[]
  selectedId: string | null
  selected: VideoItem | null
  /** With select, the first added video becomes the selected one right away. */
  addFiles: (files: FileList | File[] | null, options?: { select?: boolean }) => Promise<void>
  remove: (id: string) => void
  assignCamera: (id: string, cameraId: string | null) => void
  select: (id: string | null) => void
}

function createItem(file: File): VideoItem {
  return {
    id: crypto.randomUUID(),
    fileName: file.name,
    size: file.size,
    type: file.type,
    url: URL.createObjectURL(file),
    duration: null,
    width: null,
    height: null,
    thumbnail: null,
    cameraId: null,
    addedAt: new Date(),
    status: 'reading',
  }
}

/**
 * Keeps a local library of videos in the browser. Object URLs are created on add and revoked on
 * remove and unmount so memory does not leak. Metadata is read asynchronously per file.
 */
export function useVideoLibrary(): VideoLibrary {
  const [videos, setVideos] = useState<VideoItem[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const videosRef = useRef(videos)

  useEffect(() => {
    videosRef.current = videos
  }, [videos])

  const revoke = useCallback((url: string) => {
    try {
      URL.revokeObjectURL(url)
    } catch {
      // Ignore revoked URLs.
    }
  }, [])

  const addFiles = useCallback(async (files: FileList | File[] | null, options: { select?: boolean } = {}) => {
    if (!files || files.length === 0) return
    const incoming = Array.from(files).map(createItem)
    setVideos(current => [...current, ...incoming])
    if (options.select) setSelectedId(incoming[0].id)

    await Promise.all(
      incoming.map(async item => {
        try {
          const metadata = await readVideoMetadata(item.url)
          setVideos(current =>
            current.map(video =>
              video.id === item.id
                ? { ...video, ...metadata, status: 'ready' as const }
                : video,
            ),
          )
        } catch {
          setVideos(current =>
            current.map(video =>
              video.id === item.id ? { ...video, status: 'error' as const } : video,
            ),
          )
        }
      }),
    )
  }, [])

  const remove = useCallback(
    (id: string) => {
      const item = videosRef.current.find(video => video.id === id)
      if (!item) return
      revoke(item.url)
      setVideos(current => current.filter(video => video.id !== id))
      setSelectedId(current => (current === id ? null : current))
    },
    [revoke],
  )

  const assignCamera = useCallback((id: string, cameraId: string | null) => {
    setVideos(current =>
      current.map(video => (video.id === id ? { ...video, cameraId } : video)),
    )
  }, [])

  const select = useCallback((id: string | null) => {
    setSelectedId(id)
  }, [])

  useEffect(() => {
    return () => {
      for (const video of videosRef.current) {
        revoke(video.url)
      }
    }
  }, [revoke])

  const selected = videos.find(video => video.id === selectedId) ?? null

  return {
    videos,
    selectedId,
    selected,
    addFiles,
    remove,
    assignCamera,
    select,
  }
}
