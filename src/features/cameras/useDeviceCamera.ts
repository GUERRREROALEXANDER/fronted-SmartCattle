import { useCallback, useEffect, useRef, useState } from 'react'
import { DEVICE_FRAME_MS, DEVICE_FRAME_QUALITY, deviceCameraProblem, frameSize, removeCamera, sendCameraFrame } from '../../services'

const wait = (ms: number) => new Promise(resolve => setTimeout(resolve, ms))

/** Opens this device's camera and keeps sending pictures to the AI service while the page stays open. */
export function useDeviceCamera(onEnded: (message: string) => void) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const finish = useRef<(() => void) | null>(null)
  const [activeId, setActiveId] = useState('')
  const [weakSignal, setWeakSignal] = useState(false)

  const stop = useCallback(() => {
    finish.current?.()
    finish.current = null
    setActiveId('')
    setWeakSignal(false)
  }, [])

  // Leaving the page ends the broadcast: nobody would be sending anything to the camera left running.
  useEffect(() => stop, [stop])

  /** Asks for the camera first: a refusal must not leave anything connected. Throws a text for the person. */
  const open = useCallback(async (): Promise<MediaStream> => {
    try {
      return await navigator.mediaDevices.getUserMedia({
        audio: false, video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
      })
    } catch (error) {
      throw new Error(deviceCameraProblem(error), { cause: error })
    }
  }, [])

  const send = useCallback((media: MediaStream, baseUrl: string, cameraId: string) => {
    const video = videoRef.current
    if (!video) {
      media.getTracks().forEach(track => track.stop())
      return
    }
    const controller = new AbortController()
    let running = true
    let wakeLock: WakeLockSentinel | null = null
    // The phone sits on a post, untouched: without this its screen goes off and the browser stops the camera.
    void navigator.wakeLock?.request('screen').then(lock => {
      if (running) wakeLock = lock
      else void lock.release()
    }).catch(() => {})

    finish.current = () => {
      running = false
      controller.abort()
      media.getTracks().forEach(track => track.stop())
      video.srcObject = null
      void wakeLock?.release().catch(() => {})
      void removeCamera(baseUrl, cameraId).catch(() => {})
    }
    setActiveId(cameraId)
    video.srcObject = media
    void video.play().catch(() => {})

    const canvas = document.createElement('canvas')
    const picture = () => new Promise<Blob | null>(resolve => canvas.toBlob(resolve, 'image/jpeg', DEVICE_FRAME_QUALITY))

    void (async () => {
      while (running) {
        const began = Date.now()
        if (video.videoWidth) {
          const size = frameSize(video.videoWidth, video.videoHeight)
          canvas.width = size.width
          canvas.height = size.height
          canvas.getContext('2d')?.drawImage(video, 0, 0, size.width, size.height)
          const blob = await picture()
          if (blob && running) {
            try {
              const answer = await sendCameraFrame(baseUrl, cameraId, blob, controller.signal)
              setWeakSignal(false)
              if (answer === 403 || answer === 404) {
                stop()
                onEnded(answer === 404 ? 'La transmisión se cerró desde otro dispositivo.' : 'Tu sesión ya no permite transmitir esta cámara. Vuelve a entrar.')
                return
              }
            } catch {
              // No signal for a moment, which is normal in a field: it goes on trying by itself.
              if (running) setWeakSignal(true)
            }
          }
        }
        // Waits for each answer before the next picture, so a slow connection sends fewer rather than falling behind.
        await wait(Math.max(0, DEVICE_FRAME_MS - (Date.now() - began)))
      }
    })()
  }, [onEnded, stop])

  return { videoRef, activeId, weakSignal, open, send, stop }
}
