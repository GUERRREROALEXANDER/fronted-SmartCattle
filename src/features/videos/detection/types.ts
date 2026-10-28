export type DetectionClass = 'cattle' | 'person'

export interface Point {
  x: number
  y: number
}

export interface Box {
  x: number
  y: number
  w: number
  h: number
}

export interface Detection {
  trackId: string
  cls: DetectionClass
  confidence: number
  box: Box
  outside: boolean
}

export interface FrameResult {
  timeSec: number
  detections: Detection[]
  fps: number
  inferenceMs: number
}

export interface MotionBlob {
  box: Box
  area: number
}

export interface AnalysisAlert {
  track_id: string
  cls: DetectionClass
  time_sec: number
}

export interface VideoAnalysisSummary {
  video_name: string
  duration_sec: number
  frames_analyzed: number
  max_cattle: number
  max_people: number
  alerts: AnalysisAlert[]
  avg_confidence: number
  outside_ratio: number
}

export function createDefaultSafeZone(): Point[] {
  return [
    { x: 0.1, y: 0.1 },
    { x: 0.9, y: 0.1 },
    { x: 0.9, y: 0.9 },
    { x: 0.1, y: 0.9 },
  ]
}
