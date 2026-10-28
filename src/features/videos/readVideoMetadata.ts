const METADATA_TIMEOUT_MS = 12_000
const THUMBNAIL_TIMEOUT_MS = 8_000

export interface VideoMetadata {
  duration: number | null
  width: number | null
  height: number | null
  thumbnail: string | null
}

interface ReadOptions {
  timeoutMs?: number
  preferredWidth?: number
}

function captureFrame(video: HTMLVideoElement, time: number, preferredWidth = 320): Promise<string | null> {
  return new Promise((resolve, reject) => {
    const canvas = document.createElement('canvas')
    const scale = preferredWidth / video.videoWidth
    canvas.width = preferredWidth
    canvas.height = Math.round(video.videoHeight * scale)

    const ctx = canvas.getContext('2d')
    if (!ctx) {
      resolve(null)
      return
    }

    const onSeeked = () => {
      cleanup()
      try {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        resolve(canvas.toDataURL('image/jpeg', 0.82))
      } catch {
        resolve(null)
      }
    }

    const onError = () => {
      cleanup()
      reject(new Error('No se pudo capturar la miniatura.'))
    }

    const cleanup = () => {
      video.removeEventListener('seeked', onSeeked)
      video.removeEventListener('error', onError)
    }

    video.addEventListener('seeked', onSeeked, { once: true })
    video.addEventListener('error', onError, { once: true })
    video.currentTime = time
  })
}

// MediaRecorder WebM files have no duration header; seeking far forward makes the browser compute it.
function resolveUnknownDuration(video: HTMLVideoElement): Promise<void> {
  return new Promise(resolve => {
    const onChange = () => {
      if (!Number.isFinite(video.duration)) return
      video.removeEventListener('durationchange', onChange)
      video.removeEventListener('timeupdate', onChange)
      resolve()
    }
    video.addEventListener('durationchange', onChange)
    video.addEventListener('timeupdate', onChange)
    video.currentTime = Number.MAX_SAFE_INTEGER
  })
}

async function withTimeout<T>(promise: Promise<T>, ms: number, message: string): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => reject(new Error(message)), ms)
  })
  try {
    return await Promise.race([promise, timeout])
  } finally {
    clearTimeout(timer)
  }
}

/**
 * Reads duration, intrinsic dimensions and a thumbnail from a video object URL.
 * The caller is responsible for revoking the URL. All transient elements are cleaned up here.
 */
export async function readVideoMetadata(url: string, options: ReadOptions = {}): Promise<VideoMetadata> {
  const video = document.createElement('video')
  video.crossOrigin = 'anonymous'
  video.muted = true
  video.playsInline = true
  video.preload = 'metadata'

  try {
    await withTimeout(
      new Promise<void>((resolve, reject) => {
        const onLoadedMetadata = () => {
          cleanup()
          resolve()
        }
        const onError = () => {
          cleanup()
          reject(new Error('No se pudo leer los metadatos del video.'))
        }
        const cleanup = () => {
          video.removeEventListener('loadedmetadata', onLoadedMetadata)
          video.removeEventListener('error', onError)
        }
        video.addEventListener('loadedmetadata', onLoadedMetadata, { once: true })
        video.addEventListener('error', onError, { once: true })
        video.src = url
      }),
      options.timeoutMs ?? METADATA_TIMEOUT_MS,
      'El video tardó demasiado en cargar sus metadatos.',
    )

    if (video.duration === Infinity) {
      try {
        await withTimeout(resolveUnknownDuration(video), 4000, 'No se pudo calcular la duración.')
      } catch {
        // Keep the duration unknown; playback still works.
      }
    }

    const duration = Number.isFinite(video.duration) && video.duration > 0 ? video.duration : null
    const width = video.videoWidth || null
    const height = video.videoHeight || null

    let thumbnail: string | null = null
    if (duration != null && width && height) {
      const frameTime = Math.max(0, Math.min(Math.max(duration * 0.1, 1), duration - 0.1))
      try {
        thumbnail = await withTimeout(
          captureFrame(video, frameTime, options.preferredWidth),
          THUMBNAIL_TIMEOUT_MS,
          'El video tardó demasiado en generar la miniatura.',
        )
      } catch {
        thumbnail = null
      }
    }

    return { duration, width, height, thumbnail }
  } finally {
    video.pause()
    video.src = ''
    video.load()
  }
}
