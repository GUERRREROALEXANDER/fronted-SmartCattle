import { BackgroundModel, findConnectedComponents, mergeOverlappingBoxes } from './motion'
import { DetectionTracker } from './tracking'
import { createDefaultSafeZone } from './types'
import type { FrameResult, Point } from './types'

const ANALYSIS_WIDTH = 160
// Three consecutive sightings (~0.3 s at 10 Hz) before a box is shown.
const CONFIRM_HITS = 3

export class VideoDetectionEngine {
  private readonly background = new BackgroundModel()
  private readonly tracker = new DetectionTracker(CONFIRM_HITS)
  private readonly zone = createDefaultSafeZone()
  private canvas: HTMLCanvasElement | null = null
  private context: CanvasRenderingContext2D | null = null
  private lastAnalysisAt: number | null = null
  private fps = 0

  reset(): void {
    this.background.reset()
    this.tracker.reset()
    this.lastAnalysisAt = null
    this.fps = 0
  }

  /** After a seek the background no longer matches the picture; relearn it without reusing track ids. */
  resync(): void {
    this.background.reset()
    this.tracker.clearTracks()
    this.lastAnalysisAt = null
  }

  analyze(video: HTMLVideoElement, timeSec: number, zone: readonly Point[] = this.zone): FrameResult {
    const startedAt = performance.now()
    const { context, width, height } = this.prepareFrame(video)

    context.drawImage(video, 0, 0, width, height)
    const image = context.getImageData(0, 0, width, height)
    const mask = this.background.process(image.data, width, height)
    const components = findConnectedComponents(mask, width, height)
    const blobs = mergeOverlappingBoxes(components)
    const detections = this.tracker.update(blobs, timeSec, zone)

    if (this.lastAnalysisAt !== null) {
      const elapsedMs = startedAt - this.lastAnalysisAt
      if (elapsedMs > 0) {
        const instantaneousFps = 1000 / elapsedMs
        this.fps = this.fps === 0 ? instantaneousFps : this.fps * 0.8 + instantaneousFps * 0.2
      }
    }
    this.lastAnalysisAt = startedAt

    return {
      timeSec,
      detections,
      fps: this.fps,
      inferenceMs: performance.now() - startedAt,
    }
  }

  private prepareFrame(video: HTMLVideoElement): {
    context: CanvasRenderingContext2D
    width: number
    height: number
  } {
    const sourceWidth = video.videoWidth
    const sourceHeight = video.videoHeight
    if (!Number.isFinite(sourceWidth) || !Number.isFinite(sourceHeight) || sourceWidth <= 0 || sourceHeight <= 0) {
      throw new Error('No se puede analizar el video porque sus dimensiones todavía no están disponibles.')
    }

    if (!this.canvas || !this.context) {
      if (typeof document === 'undefined') {
        throw new Error('No se pudo iniciar el análisis porque el navegador no ofrece un contexto 2D.')
      }
      this.canvas = document.createElement('canvas')
      this.context = this.canvas.getContext('2d', { willReadFrequently: true })
    }
    if (!this.context) {
      throw new Error('No se pudo iniciar el análisis porque el navegador no ofrece un contexto 2D.')
    }

    const width = Math.min(ANALYSIS_WIDTH, Math.round(sourceWidth))
    const height = Math.max(1, Math.round(width * sourceHeight / sourceWidth))
    if (this.canvas.width !== width) this.canvas.width = width
    if (this.canvas.height !== height) this.canvas.height = height

    return { context: this.context, width, height }
  }
}
