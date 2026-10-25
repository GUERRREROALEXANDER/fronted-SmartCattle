import { createContext, useContext } from 'react'
import type { VideoLibrary } from './useVideoLibrary'

export const VideoLibraryContext = createContext<VideoLibrary | null>(null)

export function useVideoLibraryContext(): VideoLibrary {
  const context = useContext(VideoLibraryContext)
  if (!context) throw new Error('useVideoLibraryContext must be used within VideoLibraryProvider')
  return context
}
