import { useCallback, useEffect, useRef, useState, type RefObject } from 'react'
import { alarm } from '../../../lib/alarm'
import { AlertTransitionCounter, AnalysisMetrics } from '../detection/alerts'
import { VideoDetectionEngine } from '../detection/VideoDetectionEngine'
import type { AnalysisAlert, FrameResult, Point, VideoAnalysisSummary } from '../detection/types'
import { alarmReason, alarmSourceId, countDetections, type LiveCounts } from './analysisModel'

const ANALYSIS_INTERVAL_MS = 100
const HUD_INTERVAL_MS = 200
const SIREN_REPEAT_MS = 2500

function ensureEngine(ref: RefObject<VideoDetectionEngine | null>): VideoDetectionEngine {
  ref.current ??= new VideoDetectionEngine()
  return ref.current
}

export type AnalysisPhase = 'idle' | 'running' | 'paused' | 'done'

export interface HudStats {
  fps: number
  inferenceMs: number
  timeSec: number
  counts: LiveCounts
}

const EMPTY_HUD: HudStats = {
  fps: 0,
  inferenceMs: 0,
  timeSec: 0,
  counts: { cattle: 0, people: 0, outside: 0, cattleOutside: 0, peopleInside: 0 },
}

interface Options {
  videoRef: RefObject<HTMLVideoElement | null>
  videoId: string
  videoName: string
  knownDurationSec: number | null
  zoneRef: RefObject<Point[]>
}

export interface VideoAnalysis {
  phase: AnalysisPhase
  hud: HudStats
  alerts: AnalysisAlert[]
  summary: VideoAnalysisSummary | null
  error: string | null
  /** Latest analyzed frame, read by the overlay on every animation frame. */
  frameRef: RefObject<FrameResult | null>
  start: () => void
  finish: () => void
  discard: () => void
}

/**
 * Runs the simulated detector about ten times per second while the video plays, keeps the summary
 * metrics, and drives the shared alarm while any cattle is outside the safe zone.
 */
export function useVideoAnalysis({ videoRef, videoId, videoName, knownDurationSec, zoneRef }: Options): VideoAnalysis {
  const [phase, setPhase] = useState<AnalysisPhase>('idle')
  const [hud, setHud] = useState<HudStats>(EMPTY_HUD)
  const [alerts, setAlerts] = useState<AnalysisAlert[]>([])
  const [summary, setSummary] = useState<VideoAnalysisSummary | null>(null)
  const [error, setError] = useState<string | null>(null)

  const engineRef = useRef<VideoDetectionEngine | null>(null)
  const counterRef = useRef(new AlertTransitionCounter())
  const metricsRef = useRef(new AnalysisMetrics())
  const alertsRef = useRef<AnalysisAlert[]>([])
  const frameRef = useRef<FrameResult | null>(null)
  const phaseRef = useRef<AnalysisPhase>('idle')
  const alarmOnRef = useRef(false)
  const lastSirenRef = useRef(0)
  const sourceId = alarmSourceId(videoId)

  const updatePhase = useCallback((next: AnalysisPhase) => {
    phaseRef.current = next
    setPhase(next)
  }, [])

  const stopAlarm = useCallback(() => {
    alarmOnRef.current = false
    alarm.clear(sourceId)
  }, [sourceId])

  const finish = useCallback(() => {
    if (phaseRef.current !== 'running' && phaseRef.current !== 'paused') return
    const video = videoRef.current
    stopAlarm()
    const played = video?.currentTime ?? 0
    const duration = Math.max(played, knownDurationSec ?? 0, Number.isFinite(video?.duration) ? video?.duration ?? 0 : 0)
    setSummary(metricsRef.current.finish(videoName, duration, alertsRef.current))
    updatePhase('done')
    video?.pause()
  }, [knownDurationSec, stopAlarm, updatePhase, videoName, videoRef])

  const resetState = useCallback(() => {
    ensureEngine(engineRef).reset()
    counterRef.current.reset()
    metricsRef.current.reset()
    alertsRef.current = []
    frameRef.current = null
    setAlerts([])
    setSummary(null)
    setError(null)
    setHud(EMPTY_HUD)
  }, [])

  const start = useCallback(() => {
    const video = videoRef.current
    if (!video) return
    resetState()
    updatePhase('running')
    video.currentTime = 0
    void video.play().catch(() => {
      setError('El navegador no permitió reproducir el video. Presiona reproducir para continuar.')
      updatePhase('paused')
    })
  }, [resetState, updatePhase, videoRef])

  const discard = useCallback(() => {
    stopAlarm()
    resetState()
    updatePhase('idle')
  }, [resetState, stopAlarm, updatePhase])

  // Media events move the phase so the native state is the single source of truth.
  useEffect(() => {
    const video = videoRef.current
    if (!video) return
    const onPause = () => {
      if (video.ended) return
      stopAlarm()
      if (phaseRef.current === 'running') updatePhase('paused')
    }
    const onPlay = () => {
      if (phaseRef.current === 'paused') updatePhase('running')
    }
    const onSeeking = () => {
      if (phaseRef.current === 'running' || phaseRef.current === 'paused') ensureEngine(engineRef).resync()
    }
    const onEnded = () => finish()
    video.addEventListener('pause', onPause)
    video.addEventListener('play', onPlay)
    video.addEventListener('seeking', onSeeking)
    video.addEventListener('ended', onEnded)
    return () => {
      video.removeEventListener('pause', onPause)
      video.removeEventListener('play', onPlay)
      video.removeEventListener('seeking', onSeeking)
      video.removeEventListener('ended', onEnded)
    }
  }, [finish, stopAlarm, updatePhase, videoRef])

  useEffect(() => {
    if (phase !== 'running') return
    let raf = 0
    let lastAnalysis = 0
    let lastHud = 0
    let lastMediaTime = -1

    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      const video = videoRef.current
      if (!video || video.paused || video.ended || video.readyState < 2) return
      if (now - lastAnalysis < ANALYSIS_INTERVAL_MS || video.currentTime === lastMediaTime) return
      lastAnalysis = now
      lastMediaTime = video.currentTime

      let frame: FrameResult
      try {
        frame = ensureEngine(engineRef).analyze(video, video.currentTime, zoneRef.current)
      } catch (cause) {
        setError(cause instanceof Error && cause.message.startsWith('No se') ? cause.message
          : 'No se pudo leer el video para analizarlo. Si viene de otro sitio, descárgalo y súbelo de nuevo.')
        video.pause()
        return
      }
      frameRef.current = frame
      metricsRef.current.observe(frame)
      const fresh = counterRef.current.update(frame.detections, frame.timeSec)
      if (fresh.length > 0) {
        alertsRef.current = [...alertsRef.current, ...fresh]
        setAlerts(alertsRef.current)
      }

      const counts = countDetections(frame.detections)
      if (counts.cattleOutside > 0) {
        if (!alarmOnRef.current || now - lastSirenRef.current > SIREN_REPEAT_MS) {
          alarm.raise(sourceId, alarmReason(videoName))
          lastSirenRef.current = now
        }
        alarmOnRef.current = true
      } else if (alarmOnRef.current) {
        stopAlarm()
      }

      if (now - lastHud >= HUD_INTERVAL_MS || fresh.length > 0) {
        lastHud = now
        setHud({ fps: frame.fps, inferenceMs: frame.inferenceMs, timeSec: frame.timeSec, counts })
      }
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [phase, sourceId, stopAlarm, videoName, videoRef, zoneRef])

  useEffect(() => () => alarm.clear(sourceId), [sourceId])

  return { phase, hud, alerts, summary, error, frameRef, start, finish, discard }
}
