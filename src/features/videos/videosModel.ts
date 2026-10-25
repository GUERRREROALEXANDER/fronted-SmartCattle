export const ACCEPTED_VIDEO_TYPES = [
  'video/mp4',
  'video/webm',
  'video/quicktime',
  'video/x-matroska',
  'video/*',
] as const

/** 1 GB is a reasonable ceiling for short pasture-camera clips in the browser. */
export const MAX_VIDEO_SIZE = 1_073_741_824

export type VideoStatus = 'reading' | 'ready' | 'error'

export interface VideoItem {
  id: string
  fileName: string
  size: number
  type: string
  url: string
  duration: number | null
  width: number | null
  height: number | null
  thumbnail: string | null
  cameraId: string | null
  addedAt: Date
  status: VideoStatus
}

export interface VideoValidationResult {
  ok: boolean
  reason?: string
}

// Any video/* type is accepted; the browser decides later whether it can decode it.
function isVideoType(type: string): boolean {
  return type.startsWith('video/')
}

/**
 * Checks a file before it is added to the library.
 * Returns Spanish reasons because the UI is in Spanish.
 */
export function validateVideoFile(file: File): VideoValidationResult {
  if (!isVideoType(file.type)) return { ok: false, reason: 'El archivo no parece ser un video.' }
  if (file.size === 0) return { ok: false, reason: 'El video está vacío.' }
  if (file.size > MAX_VIDEO_SIZE) return { ok: false, reason: 'El video pesa más de 1 GB.' }
  return { ok: true }
}

/** Compact byte label: B, KB, MB, GB. */
export function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1)
  const value = bytes / Math.pow(1024, index)
  const fraction = index === 0 ? 0 : value >= 100 ? 0 : 1
  return `${value.toLocaleString('es-CO', { maximumFractionDigits: fraction })} ${units[index]}`
}

/** Formats seconds as m:ss or h:mm:ss. */
export function formatDuration(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
  const total = Math.round(seconds)
  const hours = Math.floor(total / 3600)
  const minutes = Math.floor((total % 3600) / 60)
  const secs = total % 60
  const paddedSeconds = String(secs).padStart(2, '0')
  if (hours > 0) {
    return `${hours}:${String(minutes).padStart(2, '0')}:${paddedSeconds}`
  }
  return `${minutes}:${paddedSeconds}`
}

/** The most recently added ready video assigned to a camera, or null. */
export function videoForCamera(videos: readonly VideoItem[], cameraId: string): VideoItem | null {
  let latest: VideoItem | null = null
  for (const video of videos) {
    if (video.cameraId !== cameraId || video.status !== 'ready') continue
    if (!latest || video.addedAt.getTime() >= latest.addedAt.getTime()) latest = video
  }
  return latest
}

export function videoResolution(width: number | null, height: number | null): string | null {
  if (width && height) return `${width}×${height}`
  return null
}
