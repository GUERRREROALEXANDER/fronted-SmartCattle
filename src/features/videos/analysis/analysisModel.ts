import type { VideoAnalysisPayload } from '../../../services/videoAnalysisService'
import type { AnalysisAlert, Detection, Point, VideoAnalysisSummary } from '../detection/types'

export const MODEL_LABEL = 'YOLOv8n · simulación'

export interface LiveCounts {
  cattle: number
  people: number
  outside: number
  cattleOutside: number
  peopleInside: number
}

/** Tracks fading out after losing their blob are not drawn or counted below this confidence. */
export const MIN_VISIBLE_CONFIDENCE = 0.3

export function countDetections(detections: readonly Detection[]): LiveCounts {
  const counts: LiveCounts = { cattle: 0, people: 0, outside: 0, cattleOutside: 0, peopleInside: 0 }
  for (const detection of detections) {
    if (detection.confidence < MIN_VISIBLE_CONFIDENCE) continue
    if (detection.cls === 'cattle') counts.cattle++
    else counts.people++
    if (detection.outside) counts.outside++
    if (detection.cls === 'cattle' && detection.outside) counts.cattleOutside++
    if (detection.cls === 'person' && !detection.outside) counts.peopleInside++
  }
  return counts
}

export function detectionLabel(detection: Pick<Detection, 'cls' | 'confidence' | 'trackId'>): string {
  const name = detection.cls === 'cattle' ? 'Vaca' : 'Persona'
  return `${name} ${detection.confidence.toFixed(2)} #${detection.trackId}`
}

export function alarmSourceId(videoId: string): string {
  return `video:${videoId}`
}

export function alarmReason(videoName: string): string {
  return `Vaca fuera del perímetro en "${videoName}"`
}

const clamp01 = (value: number) => Math.min(1, Math.max(0, value))

/** Returns a new zone with one corner moved to `point`, clamped to the frame. */
export function moveZoneCorner(zone: readonly Point[], index: number, point: Point): Point[] {
  return zone.map((corner, current) => (current === index ? { x: clamp01(point.x), y: clamp01(point.y) } : { ...corner }))
}

export function nudgeZoneCorner(zone: readonly Point[], index: number, dx: number, dy: number): Point[] {
  const corner = zone[index]
  if (!corner) return zone.map(point => ({ ...point }))
  return moveZoneCorner(zone, index, { x: corner.x + dx, y: corner.y + dy })
}

const CORNER_NAMES = ['superior izquierda', 'superior derecha', 'inferior derecha', 'inferior izquierda']

export function cornerLabel(index: number, point: Point): string {
  const name = CORNER_NAMES[index] ?? `${index + 1}`
  return `Esquina ${name} de la zona segura: ${Math.round(point.x * 100)} % horizontal, ${Math.round(point.y * 100)} % vertical`
}

export function isValidZone(value: unknown): value is Point[] {
  return Array.isArray(value) && value.length === 4 && value.every(point =>
    point !== null && typeof point === 'object'
    && Number.isFinite((point as Point).x) && Number.isFinite((point as Point).y)
    && (point as Point).x >= 0 && (point as Point).x <= 1 && (point as Point).y >= 0 && (point as Point).y <= 1)
}

/** Timeline marker position (0..100 %) for each alert; alerts past the end are clamped. */
export function alertMarkers(alerts: readonly AnalysisAlert[], durationSec: number): { alert: AnalysisAlert; percent: number }[] {
  if (!Number.isFinite(durationSec) || durationSec <= 0) return []
  return alerts.map(alert => ({ alert, percent: Math.min(100, Math.max(0, (alert.time_sec / durationSec) * 100)) }))
}

/** Seconds with tenths, e.g. 0:03.4, used for HUD and alert lists. */
export function formatClock(seconds: number): string {
  if (!Number.isFinite(seconds) || seconds < 0) return '0:00.0'
  const tenths = Math.floor(seconds * 10)
  const minutes = Math.floor(tenths / 600)
  const rest = (tenths % 600) / 10
  return `${minutes}:${rest.toFixed(1).padStart(4, '0')}`
}

export function formatPercent(ratio: number): string {
  if (!Number.isFinite(ratio)) return '0 %'
  return `${Math.round(Math.min(1, Math.max(0, ratio)) * 100)} %`
}

export type AnalysisPayload = VideoAnalysisPayload

const MAX_PAYLOAD_ALERTS = 500
const MAX_NAME_LENGTH = 200

/** Shapes the summary to the backend schema: integer track ids, bounded ratios and lists. */
export function toAnalysisPayload(summary: VideoAnalysisSummary): AnalysisPayload {
  const name = summary.video_name.trim().slice(0, MAX_NAME_LENGTH) || 'video'
  return {
    video_name: name,
    duration_sec: nonNegative(summary.duration_sec),
    frames_analyzed: Math.max(0, Math.round(summary.frames_analyzed)),
    max_cattle: Math.max(0, Math.round(summary.max_cattle)),
    max_people: Math.max(0, Math.round(summary.max_people)),
    alerts: summary.alerts.slice(0, MAX_PAYLOAD_ALERTS).map((alert, index) => {
      const parsed = Number.parseInt(alert.track_id, 10)
      return {
        track_id: Number.isFinite(parsed) && parsed >= 0 ? parsed : index,
        cls: alert.cls,
        time_sec: nonNegative(alert.time_sec),
      }
    }),
    avg_confidence: clamp01(nonNegative(summary.avg_confidence)),
    outside_ratio: clamp01(nonNegative(summary.outside_ratio)),
  }
}

function nonNegative(value: number): number {
  return Number.isFinite(value) && value > 0 ? value : 0
}

export interface AnalysisReport {
  generated_at: string
  model: string
  mode: 'simulation'
  safe_zone: Point[]
  summary: AnalysisPayload
}

export function buildReport(summary: VideoAnalysisSummary, zone: readonly Point[], now = new Date()): AnalysisReport {
  return {
    generated_at: now.toISOString(),
    model: MODEL_LABEL,
    mode: 'simulation',
    safe_zone: zone.map(point => ({ x: round3(point.x), y: round3(point.y) })),
    summary: toAnalysisPayload(summary),
  }
}

export function reportFileName(videoName: string): string {
  const base = videoName.replace(/\.[^.]+$/, '').replace(/[^\w-]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase()
  return `reporte-${base || 'video'}.json`
}

function round3(value: number): number {
  return Math.round(value * 1000) / 1000
}
