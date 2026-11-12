import { useEffect, useRef, useState } from 'react'
import { Loader2, VideoOff } from 'lucide-react'
import styles from './HlsPlayer.module.css'

type PlayerStatus = 'loading' | 'playing' | 'reconnecting' | 'stalled' | 'unsupported'

const RETRY_MS = 3000
/** About 15 s without video: a camera that is starting has had its time, so say what to check. It keeps retrying. */
const STALLED_AFTER = 5

/**
 * Plays an HLS address. hls.js loads with the first player, so nobody who never opens one downloads it. Safari plays
 * HLS by itself. A stream that is not ready, or that drops, is retried for as long as the player stays open.
 */
export function HlsPlayer({ url, title }: { url: string; title: string }) {
  const video = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<PlayerStatus>('loading')

  useEffect(() => {
    const element = video.current
    if (!element) return
    let closed = false
    let retry: ReturnType<typeof setTimeout> | undefined
    let destroy = () => {}
    let failures = 0
    const onPlaying = () => {
      failures = 0
      setStatus('playing')
    }
    const onWaiting = () => setStatus(current => current === 'playing' ? 'reconnecting' : current)
    element.addEventListener('playing', onPlaying)
    element.addEventListener('waiting', onWaiting)

    void (async () => {
      const { default: Hls } = await import('hls.js')
      if (closed) return
      if (!Hls.isSupported()) {
        if (element.canPlayType('application/vnd.apple.mpegurl')) {
          element.src = url
          void element.play().catch(() => {})
        } else setStatus('unsupported')
        return
      }
      const hls = new Hls({ backBufferLength: 30 })
      destroy = () => hls.destroy()
      hls.on(Hls.Events.ERROR, (_event, data) => {
        if (!data.fatal) return
        if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
          hls.recoverMediaError()
          return
        }
        failures += 1
        setStatus(current => failures >= STALLED_AFTER ? 'stalled' : current === 'playing' ? 'reconnecting' : current)
        clearTimeout(retry)
        retry = setTimeout(() => hls.loadSource(url), RETRY_MS)
      })
      hls.on(Hls.Events.MANIFEST_PARSED, () => void element.play().catch(() => {}))
      hls.loadSource(url)
      hls.attachMedia(element)
    })().catch(() => {
      if (!closed) setStatus('unsupported')
    })

    return () => {
      closed = true
      clearTimeout(retry)
      destroy()
      element.removeEventListener('playing', onPlaying)
      element.removeEventListener('waiting', onWaiting)
      element.removeAttribute('src')
      element.load()
      setStatus('loading')
    }
  }, [url])

  return <div className={styles.player}>
    <video ref={video} className={styles.video} muted playsInline controls={status === 'playing'} aria-label={title} />
    {status !== 'playing' && <div className={styles.overlay} role="status">
      {status === 'unsupported' || status === 'stalled'
        ? <><VideoOff size={24} strokeWidth={1.5} aria-hidden="true" /><span>{status === 'stalled'
          ? 'El video no llega todavía. Se sigue intentando; revisa que la cámara y el servicio de video estén encendidos.'
          : 'Este navegador no puede reproducir este video. Prueba con Chrome, Edge o Firefox.'}</span></>
        : <><Loader2 className={styles.spinner} size={24} strokeWidth={1.75} aria-hidden="true" /><span>{status === 'reconnecting' ? 'Reconectando el video…' : 'Cargando el video…'}</span></>}
    </div>}
  </div>
}
