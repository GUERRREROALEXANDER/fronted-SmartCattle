import { describe, expect, it } from 'vitest'
import { createDefaultSafeZone } from '../detection/types'
import type { Detection, VideoAnalysisSummary } from '../detection/types'
import {
  alarmReason,
  alarmSourceId,
  alertMarkers,
  buildReport,
  countDetections,
  detectionLabel,
  formatClock,
  formatPercent,
  isValidZone,
  moveZoneCorner,
  nudgeZoneCorner,
  reportFileName,
  toAnalysisPayload,
} from './analysisModel'
import { actorPosition, SYNTHETIC_ACTORS } from './syntheticScene'

const detection = (trackId: string, cls: Detection['cls'], outside: boolean): Detection => ({
  trackId, cls, outside, confidence: 0.914, box: { x: 0.1, y: 0.1, w: 0.1, h: 0.1 },
})

const summary: VideoAnalysisSummary = {
  video_name: '  potrero norte.mp4 ',
  duration_sec: 12.4,
  frames_analyzed: 120,
  max_cattle: 4,
  max_people: 1,
  alerts: [{ track_id: '3', cls: 'cattle', time_sec: 5.2 }, { track_id: 'x', cls: 'person', time_sec: -1 }],
  avg_confidence: 0.884,
  outside_ratio: 0.25,
}

describe('analysisModel', () => {
  it('counts classes, outside boxes and people inside', () => {
    expect(countDetections([
      detection('1', 'cattle', false),
      detection('2', 'cattle', true),
      detection('3', 'person', false),
      detection('4', 'person', true),
    ])).toEqual({ cattle: 2, people: 2, outside: 2, cattleOutside: 1, peopleInside: 1 })
  })

  it('labels detections like the YOLO chips', () => {
    expect(detectionLabel(detection('3', 'cattle', false))).toBe('Vaca 0.91 #3')
    expect(detectionLabel({ cls: 'person', confidence: 0.87, trackId: '5' })).toBe('Persona 0.87 #5')
  })

  it('builds the alarm source and reason for a video', () => {
    expect(alarmSourceId('abc')).toBe('video:abc')
    expect(alarmReason('lote.mp4')).toBe('Vaca fuera del perímetro en "lote.mp4"')
  })

  it('moves and nudges zone corners inside the frame without mutating the input', () => {
    const zone = createDefaultSafeZone()
    const moved = moveZoneCorner(zone, 1, { x: 1.4, y: -0.2 })
    expect(moved[1]).toEqual({ x: 1, y: 0 })
    expect(zone[1]).toEqual({ x: 0.9, y: 0.1 })
    const nudged = nudgeZoneCorner(zone, 0, -0.05, 0.01)
    expect(nudged[0].x).toBeCloseTo(0.05)
    expect(nudged[0].y).toBeCloseTo(0.11)
  })

  it('validates stored zones', () => {
    expect(isValidZone(createDefaultSafeZone())).toBe(true)
    expect(isValidZone([{ x: 0, y: 0 }])).toBe(false)
    expect(isValidZone([{ x: 0, y: 0 }, { x: 2, y: 0 }, { x: 1, y: 1 }, { x: 0, y: 1 }])).toBe(false)
    expect(isValidZone('nope')).toBe(false)
  })

  it('places alert markers on the timeline', () => {
    expect(alertMarkers(summary.alerts, 0)).toEqual([])
    const markers = alertMarkers([{ track_id: '1', cls: 'cattle', time_sec: 3 }, { track_id: '2', cls: 'cattle', time_sec: 20 }], 12)
    expect(markers.map(marker => marker.percent)).toEqual([25, 100])
  })

  it('formats clock and percent values', () => {
    expect(formatClock(0)).toBe('0:00.0')
    expect(formatClock(65.27)).toBe('1:05.2')
    expect(formatClock(Number.NaN)).toBe('0:00.0')
    expect(formatPercent(0.254)).toBe('25 %')
    expect(formatPercent(3)).toBe('100 %')
  })

  it('shapes the payload to the backend schema', () => {
    const payload = toAnalysisPayload(summary)
    expect(payload.video_name).toBe('potrero norte.mp4')
    expect(payload.alerts).toEqual([
      { track_id: 3, cls: 'cattle', time_sec: 5.2 },
      { track_id: 1, cls: 'person', time_sec: 0 },
    ])
    expect(toAnalysisPayload({ ...summary, avg_confidence: 1.4, outside_ratio: Number.NaN }).avg_confidence).toBe(1)
    expect(toAnalysisPayload({ ...summary, video_name: '   ' }).video_name).toBe('video')
  })

  it('builds a downloadable report with zone and model', () => {
    const report = buildReport(summary, createDefaultSafeZone(), new Date('2026-10-27T10:00:00Z'))
    expect(report.generated_at).toBe('2026-10-27T10:00:00.000Z')
    expect(report.mode).toBe('simulation')
    expect(report.safe_zone).toHaveLength(4)
    expect(report.summary.max_cattle).toBe(4)
    expect(reportFileName('Potrero Norte (1).MP4')).toBe('reporte-potrero-norte-1.json')
  })
})

describe('synthetic scene', () => {
  it('interpolates actor paths and clamps at the ends', () => {
    const path = [{ t: 0, x: 0, y: 0 }, { t: 2, x: 1, y: 1 }]
    expect(actorPosition(path, -1)).toMatchObject({ x: 0, y: 0 })
    expect(actorPosition(path, 1)).toMatchObject({ x: 0.5, y: 0.5 })
    expect(actorPosition(path, 5)).toMatchObject({ x: 1, y: 1 })
  })

  it('has one cow that leaves the default safe zone and comes back', () => {
    const escaping = SYNTHETIC_ACTORS.filter(actor => actor.kind === 'cow'
      && [0, 7.5, 12].map(time => actorPosition(actor.path, time).x > 0.9).join() === 'false,true,false')
    expect(escaping).toHaveLength(1)
  })
})
