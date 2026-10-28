import { useCallback, useEffect, useRef, useState } from 'react'
import { Pause, Play, RotateCcw, ScanSearch, Square, TriangleAlert, Volume2, VolumeX } from 'lucide-react'
import { AnimatePresence, motion, useReducedMotion } from 'motion/react'
import { Button, Notice } from '../../../components/ui'
import { AnimatedNumber, duration, ease, PulseRing } from '../../../motion'
import { safeStorage } from '../../../lib/safeStorage'
import { useMediaQuery } from '../../../lib/useMediaQuery'
import { saveAnalysis } from '../../../services/videoAnalysisService'
import { createDefaultSafeZone } from '../detection/types'
import type { Point, VideoAnalysisSummary } from '../detection/types'
import type { VideoItem } from '../videosModel'
import { AnalysisHud } from './AnalysisHud'
import { AnalysisSummary, type SaveStatus } from './AnalysisSummary'
import { AnalysisTimeline } from './AnalysisTimeline'
import { buildReport, formatClock, isValidZone, MODEL_LABEL, reportFileName, toAnalysisPayload } from './analysisModel'
import { DetectionOverlay } from './DetectionOverlay'
import { useVideoAnalysis } from './useVideoAnalysis'
import styles from './VideoAnalyzer.module.css'

const ZONE_KEY = 'smartcattle.videos.safeZone'

function loadZone(): Point[] {
  const stored = safeStorage.getJson<unknown>(ZONE_KEY)
  return isValidZone(stored) ? stored : createDefaultSafeZone()
}

export interface VideoAnalyzerProps {
  video: VideoItem
  labelledBy: string
}

export function VideoAnalyzer({ video, labelledBy }: VideoAnalyzerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const [zone, setZone] = useState<Point[]>(loadZone)
  const zoneRef = useRef(zone)
  const [playing, setPlaying] = useState(false)
  const [muted, setMuted] = useState(false)
  const [currentSec, setCurrentSec] = useState(0)
  const [mediaDuration, setMediaDuration] = useState<number | null>(null)
  const [saved, setSaved] = useState<{ summary: VideoAnalysisSummary; status: SaveStatus } | null>(null)
  const [mediaError, setMediaError] = useState(false)
  const compact = !useMediaQuery('(min-width: 1024px)')
  const reduce = useReducedMotion()

  const durationSec = video.duration ?? mediaDuration ?? 0
  const analysis = useVideoAnalysis({ videoRef, videoId: video.id, videoName: video.fileName, knownDurationSec: video.duration, zoneRef })
  const { phase, summary } = analysis
  const cattleOutside = phase === 'running' && analysis.hud.counts.cattleOutside > 0

  useEffect(() => {
    zoneRef.current = zone
    safeStorage.setJson(ZONE_KEY, zone)
  }, [zone])

  useEffect(() => {
    const element = videoRef.current
    if (!element) return
    const onTime = () => setCurrentSec(element.currentTime)
    const onPlay = () => setPlaying(true)
    const onPause = () => setPlaying(false)
    const onDuration = () => setMediaDuration(Number.isFinite(element.duration) ? element.duration : null)
    const onError = () => setMediaError(true)
    element.addEventListener('timeupdate', onTime)
    element.addEventListener('seeked', onTime)
    element.addEventListener('play', onPlay)
    element.addEventListener('pause', onPause)
    element.addEventListener('ended', onPause)
    element.addEventListener('durationchange', onDuration)
    element.addEventListener('error', onError)
    return () => {
      element.removeEventListener('timeupdate', onTime)
      element.removeEventListener('seeked', onTime)
      element.removeEventListener('play', onPlay)
      element.removeEventListener('pause', onPause)
      element.removeEventListener('ended', onPause)
      element.removeEventListener('durationchange', onDuration)
      element.removeEventListener('error', onError)
    }
  }, [])

  useEffect(() => {
    if (!summary) return
    const controller = new AbortController()
    saveAnalysis(toAnalysisPayload(summary), { signal: controller.signal })
      .then(result => setSaved({ summary, status: result.target }))
      .catch(() => { if (!controller.signal.aborted) setSaved({ summary, status: 'local' }) })
    return () => controller.abort()
  }, [summary])

  const togglePlay = () => {
    const element = videoRef.current
    if (!element) return
    if (element.paused) void element.play().catch(() => setMediaError(true))
    else element.pause()
  }

  const seek = useCallback((timeSec: number) => {
    const element = videoRef.current
    if (!element || !Number.isFinite(timeSec)) return
    element.currentTime = Math.max(0, timeSec)
    setCurrentSec(element.currentTime)
  }, [])

  const toggleMute = () => {
    const element = videoRef.current
    if (!element) return
    element.muted = !element.muted
    setMuted(element.muted)
  }

  const download = () => {
    if (!summary) return
    const report = buildReport(summary, zone)
    const blob = new Blob([JSON.stringify(report, null, 2)], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = reportFileName(video.fileName)
    document.body.append(link)
    link.click()
    link.remove()
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  }

  const saveStatus: SaveStatus = saved && saved.summary === summary ? saved.status : 'saving'
  const ratio = video.width && video.height ? video.width / video.height : 16 / 9
  const analyzing = phase === 'running' || phase === 'paused'

  return (
    <div className={styles.analyzer}>
      <div className={styles.main}>
        <div className={styles.stageFrame}>
        <div className={`${styles.stage} ${cattleOutside ? styles.alarm : ''}`}>
          <div className={styles.frame} style={{ aspectRatio: ratio, maxWidth: `calc(var(--stage-max-height) * ${ratio})` }}>
            <video
              ref={videoRef}
              src={video.url}
              className={styles.video}
              playsInline
              preload="auto"
              aria-labelledby={labelledBy}
              onClick={togglePlay}
            />
            <DetectionOverlay
              frameRef={analysis.frameRef}
              zone={zone}
              onZoneChange={setZone}
              showDetections={phase !== 'idle'}
            />
            <div className={styles.badges} aria-hidden="true">
              <span className={styles.badge}>
                <span className={`${styles.liveDot} ${phase === 'running' ? styles.liveOn : ''}`} />
                {MODEL_LABEL}
              </span>
              {phase === 'running' && analysis.hud.fps > 0 && (
                <span className={styles.badge}>{Math.round(analysis.hud.fps)} FPS · {analysis.hud.inferenceMs.toFixed(1)} ms</span>
              )}
            </div>
            <AnimatePresence>
              {cattleOutside && (
                <motion.div
                  className={styles.alarmSlot}
                  initial={reduce ? { opacity: 0 } : { opacity: 0, y: -12 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: duration.state, ease: ease.out }}
                >
                  <PulseRing className={styles.alarmRing}>
                    <span className={styles.alarmBanner}>
                      <TriangleAlert size={18} aria-hidden="true" />
                      {analysis.hud.counts.cattleOutside === 1 ? 'Vaca fuera del perímetro' : `${analysis.hud.counts.cattleOutside} vacas fuera del perímetro`}
                    </span>
                  </PulseRing>
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          <div className={styles.controls}>
            <button type="button" className={styles.control} onClick={togglePlay} aria-label={playing ? 'Pausar video' : 'Reproducir video'}>
              {playing ? <Pause size={20} aria-hidden="true" /> : <Play size={20} aria-hidden="true" />}
            </button>
            <AnalysisTimeline currentSec={currentSec} durationSec={durationSec} alerts={analysis.alerts} onSeek={seek} />
            <span className={styles.clock}>{formatClock(currentSec)}<span className={styles.clockTotal}> / {formatClock(durationSec)}</span></span>
            <button type="button" className={styles.control} onClick={toggleMute} aria-label={muted ? 'Activar sonido' : 'Silenciar'}>
              {muted ? <VolumeX size={20} aria-hidden="true" /> : <Volume2 size={20} aria-hidden="true" />}
            </button>
          </div>
        </div>
        </div>

        {compact && phase !== 'idle' && (
          <dl className={styles.strip} aria-label="Conteo en vivo">
            <div><dt>Vacas</dt><dd><AnimatedNumber value={analysis.hud.counts.cattle} /></dd></div>
            <div><dt>Personas</dt><dd><AnimatedNumber value={analysis.hud.counts.people} /></dd></div>
            <div className={analysis.hud.counts.outside > 0 ? styles.stripDanger : undefined}><dt>Fuera</dt><dd><AnimatedNumber value={analysis.hud.counts.outside} /></dd></div>
            <div className={analysis.alerts.length > 0 ? styles.stripDanger : undefined}><dt>Alertas</dt><dd><AnimatedNumber value={analysis.alerts.length} /></dd></div>
          </dl>
        )}

        <p className="visually-hidden" aria-live="assertive">{cattleOutside ? 'Alerta: vaca fuera del perímetro' : ''}</p>

        {(mediaError || analysis.error) && (
          <Notice tone="warning" title="No se pudo analizar este video">
            {analysis.error ?? 'Este navegador no puede reproducir el archivo. Prueba con MP4 (H.264) o WebM.'}
          </Notice>
        )}

        <div className={styles.actions}>
          {/* One element across phases so keyboard focus survives starting and finishing. */}
          <Button
            variant={analyzing ? 'secondary' : 'primary'}
            icon={analyzing ? Square : ScanSearch}
            onClick={analyzing ? analysis.finish : analysis.start}
            disabled={mediaError}
          >
            {phase === 'idle' ? 'Analizar con IA (simulación YOLO)' : analyzing ? 'Terminar y ver resumen' : 'Analizar de nuevo'}
          </Button>
          <Button variant="ghost" icon={RotateCcw} onClick={() => setZone(createDefaultSafeZone())}>Restablecer zona</Button>
          <p className={styles.help}>Arrastra las esquinas blancas para ajustar la zona segura. Con el teclado: Tab hasta una esquina y flechas (Mayús para pasos largos).</p>
        </div>

        {summary && (
          <AnalysisSummary summary={summary} saveStatus={saveStatus} onDownload={download} />
        )}
      </div>

      <aside className={styles.side}>
        <AnalysisHud phase={phase} hud={analysis.hud} alerts={analysis.alerts} onSeek={seek} compact={compact} />
      </aside>
    </div>
  )
}
