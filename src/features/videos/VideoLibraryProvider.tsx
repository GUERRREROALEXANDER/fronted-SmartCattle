import { useMemo, type ReactNode } from 'react'
import { useVideoLibrary } from './useVideoLibrary'
import { VideoLibraryContext } from './useVideoLibraryContext'

/** Holds the browser-only video library above the routes so it survives navigation; URLs are revoked when it unmounts. */
export function VideoLibraryProvider({ children }: { children: ReactNode }) {
  const { videos, selectedId, selected, addFiles, remove, assignCamera, select } = useVideoLibrary()
  const value = useMemo(
    () => ({ videos, selectedId, selected, addFiles, remove, assignCamera, select }),
    [videos, selectedId, selected, addFiles, remove, assignCamera, select],
  )
  return <VideoLibraryContext.Provider value={value}>{children}</VideoLibraryContext.Provider>
}
