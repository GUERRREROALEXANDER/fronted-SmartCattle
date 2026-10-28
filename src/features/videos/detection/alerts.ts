import type { AnalysisAlert, Detection, FrameResult, VideoAnalysisSummary } from './types'

const MAX_ANALYSIS_INTERVAL_SEC = 0.5

// A track must stay back inside this long before leaving again counts as a new alert,
// so box jitter on the zone line does not multiply events.
const REARM_INSIDE_SEC = 0.5

interface TrackAlertState {
  armed: boolean
  insideSince: number | null
}

export class AlertTransitionCounter {
  private stateByTrack = new Map<string, TrackAlertState>()

  reset(): void {
    this.stateByTrack.clear()
  }

  update(detections: readonly Detection[], timeSec: number): AnalysisAlert[] {
    const alerts: AnalysisAlert[] = []
    for (const detection of detections) {
      const state = this.stateByTrack.get(detection.trackId) ?? { armed: true, insideSince: null }
      if (detection.outside) {
        if (state.insideSince !== null && timeSec - state.insideSince >= REARM_INSIDE_SEC) state.armed = true
        if (state.armed) {
          alerts.push({ track_id: detection.trackId, cls: detection.cls, time_sec: timeSec })
          state.armed = false
        }
        state.insideSince = null
      } else {
        state.insideSince ??= timeSec
      }
      this.stateByTrack.set(detection.trackId, state)
    }
    return alerts
  }
}

export class AnalysisMetrics {
  private framesAnalyzed = 0
  private maxCattle = 0
  private maxPeople = 0
  private confidenceSum = 0
  private confidenceCount = 0
  private observedSec = 0
  private outsideSec = 0
  private previousTimeSec: number | null = null
  private previousCattleOutside = false

  reset(): void {
    this.framesAnalyzed = 0
    this.maxCattle = 0
    this.maxPeople = 0
    this.confidenceSum = 0
    this.confidenceCount = 0
    this.observedSec = 0
    this.outsideSec = 0
    this.previousTimeSec = null
    this.previousCattleOutside = false
  }

  observe(frame: FrameResult): void {
    if (this.previousTimeSec !== null) {
      const elapsedSec = frame.timeSec - this.previousTimeSec
      if (Number.isFinite(elapsedSec) && elapsedSec > 0) {
        const intervalSec = Math.min(elapsedSec, MAX_ANALYSIS_INTERVAL_SEC)
        this.observedSec += intervalSec
        if (this.previousCattleOutside) this.outsideSec += intervalSec
      }
    }

    let cattle = 0
    let people = 0
    let cattleOutside = false
    for (const detection of frame.detections) {
      if (detection.cls === 'cattle') {
        cattle++
        if (detection.outside) cattleOutside = true
      } else {
        people++
      }
      this.confidenceSum += detection.confidence
      this.confidenceCount++
    }

    this.framesAnalyzed++
    this.maxCattle = Math.max(this.maxCattle, cattle)
    this.maxPeople = Math.max(this.maxPeople, people)
    this.previousTimeSec = Number.isFinite(frame.timeSec) ? frame.timeSec : null
    this.previousCattleOutside = cattleOutside
  }

  finish(videoName: string, durationSec: number, alerts: readonly AnalysisAlert[]): VideoAnalysisSummary {
    const safeDuration = Number.isFinite(durationSec) ? Math.max(0, durationSec) : 0
    return {
      video_name: videoName,
      duration_sec: round(safeDuration, 2),
      frames_analyzed: this.framesAnalyzed,
      max_cattle: this.maxCattle,
      max_people: this.maxPeople,
      alerts: [...alerts],
      avg_confidence: this.confidenceCount > 0
        ? round(this.confidenceSum / this.confidenceCount, 3)
        : 0,
      outside_ratio: this.observedSec > 0 ? round(this.outsideSec / this.observedSec, 3) : 0,
    }
  }
}

function round(value: number, decimals: number): number {
  const factor = 10 ** decimals
  return Math.round(value * factor) / factor
}
