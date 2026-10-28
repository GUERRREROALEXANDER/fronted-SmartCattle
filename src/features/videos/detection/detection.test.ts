import { describe, expect, it } from 'vitest'
import { AlertTransitionCounter, AnalysisMetrics } from './alerts'
import { isBottomCenterOutside, pointInPolygon } from './geometry'
import { BackgroundModel, dilateMask, findConnectedComponents, mergeOverlappingBoxes } from './motion'
import { classifyBlob, confidenceForTrack, DetectionTracker } from './tracking'
import { createDefaultSafeZone } from './types'
import type { Box, Detection, FrameResult, MotionBlob } from './types'

function solidFrame(width: number, height: number, value: number): Uint8ClampedArray {
  const data = new Uint8ClampedArray(width * height * 4)
  for (let index = 0; index < width * height; index++) {
    data[index * 4] = value
    data[index * 4 + 1] = value
    data[index * 4 + 2] = value
    data[index * 4 + 3] = 255
  }
  return data
}

function fill(mask: Uint8Array, width: number, x: number, y: number, w: number, h: number): void {
  for (let row = y; row < y + h; row++) {
    for (let column = x; column < x + w; column++) mask[row * width + column] = 1
  }
}

function blob(box: Box): MotionBlob {
  return { box, area: box.w * box.h }
}

function detection(trackId: string, outside: boolean, cls: Detection['cls'] = 'cattle'): Detection {
  return {
    trackId,
    cls,
    outside,
    confidence: 0.9,
    box: { x: 0.2, y: 0.2, w: 0.2, h: 0.2 },
  }
}

function frame(timeSec: number, detections: Detection[]): FrameResult {
  return { timeSec, detections, fps: 10, inferenceMs: 4 }
}

describe('motion model', () => {
  it('initializes the background and detects a changed pixel with light dilation', () => {
    const model = new BackgroundModel()
    const initial = solidFrame(5, 5, 0)
    expect(Array.from(model.process(initial, 5, 5))).toEqual(Array(25).fill(0))

    const changed = new Uint8ClampedArray(initial)
    changed.set([255, 255, 255, 255], (2 * 5 + 2) * 4)
    const mask = model.process(changed, 5, 5)
    expect(mask[2 * 5 + 2]).toBe(1)
    expect(mask[1 * 5 + 1]).toBe(1)
    expect(mask[0]).toBe(0)
  })

  it('dilates active pixels into their immediate neighborhood', () => {
    const mask = new Uint8Array(16)
    mask[5] = 1
    const output = dilateMask(mask, 4, 4)
    expect([0, 1, 2, 4, 5, 6, 8, 9, 10].every(index => output[index] === 1)).toBe(true)
    expect(output.reduce((sum, value) => sum + value, 0)).toBe(9)
  })

  it('finds connected components and drops tiny blobs', () => {
    const width = 20
    const mask = new Uint8Array(width * width)
    fill(mask, width, 2, 2, 3, 3)
    fill(mask, width, 12, 12, 2, 2)
    mask[18 * width + 18] = 1
    const blobs = findConnectedComponents(mask, width, width)
    expect(blobs).toHaveLength(2)
    expect(blobs[0].box).toEqual({ x: 0.1, y: 0.1, w: 0.15, h: 0.15 })
    expect(blobs[0].area).toBeCloseTo(9 / 400)
  })

  it('merges nearby aligned fragments but preserves separate objects', () => {
    const merged = mergeOverlappingBoxes([
      blob({ x: 0.1, y: 0.1, w: 0.1, h: 0.1 }),
      blob({ x: 0.21, y: 0.1, w: 0.1, h: 0.1 }),
      blob({ x: 0.6, y: 0.6, w: 0.1, h: 0.1 }),
    ])
    expect(merged).toHaveLength(2)
    expect(merged[0].box.x).toBe(0.1)
    expect(merged[0].box.y).toBe(0.1)
    expect(merged[0].box.w).toBeCloseTo(0.21)
    expect(merged[0].box.h).toBe(0.1)
    expect(merged[0].area).toBeCloseTo(0.02)
  })
})

describe('zone geometry', () => {
  const zone = createDefaultSafeZone()

  it('uses the bottom center and treats the boundary as safe', () => {
    expect(pointInPolygon({ x: 0.5, y: 0.5 }, zone)).toBe(true)
    expect(pointInPolygon({ x: 0.1, y: 0.5 }, zone)).toBe(true)
    expect(isBottomCenterOutside({ x: 0.4, y: 0.4, w: 0.2, h: 0.5 }, zone)).toBe(false)
    expect(isBottomCenterOutside({ x: 0.4, y: 0.8, w: 0.2, h: 0.2 }, zone)).toBe(true)
  })

  it('handles concave polygons', () => {
    const concave = [
      { x: 0, y: 0 }, { x: 1, y: 0 }, { x: 1, y: 0.4 },
      { x: 0.4, y: 0.4 }, { x: 0.4, y: 1 }, { x: 0, y: 1 },
    ]
    expect(pointInPolygon({ x: 0.2, y: 0.8 }, concave)).toBe(true)
    expect(pointInPolygon({ x: 0.8, y: 0.8 }, concave)).toBe(false)
  })
})

describe('tracking and classification', () => {
  it('classifies tall objects as people and wide objects as cattle', () => {
    expect(classifyBlob({ x: 0, y: 0, w: 0.08, h: 0.2 })).toBe('person')
    expect(classifyBlob({ x: 0, y: 0, w: 0.2, h: 0.12 })).toBe('cattle')
    expect(confidenceForTrack({ x: 0, y: 0, w: 0.2, h: 0.1 }, 1, '1', 2)).toBeGreaterThanOrEqual(0.72)
    expect(confidenceForTrack({ x: 0, y: 0, w: 0.2, h: 0.1 }, 1, '1', 2)).toBeLessThanOrEqual(0.97)
  })

  it('keeps stable ids and smooths boxes between observations', () => {
    const tracker = new DetectionTracker()
    const zone = createDefaultSafeZone()
    const first = tracker.update([blob({ x: 0.2, y: 0.3, w: 0.2, h: 0.12 })], 0, zone)
    const second = tracker.update([blob({ x: 0.3, y: 0.3, w: 0.2, h: 0.12 })], 0.1, zone)
    expect(second[0].trackId).toBe(first[0].trackId)
    expect(second[0].box.x).toBeCloseTo(0.245)
  })

  it('does not flip a cattle track to person on one tall observation', () => {
    const tracker = new DetectionTracker()
    const zone = createDefaultSafeZone()
    tracker.update([blob({ x: 0.2, y: 0.3, w: 0.2, h: 0.12 })], 0, zone)
    const tall = tracker.update([blob({ x: 0.22, y: 0.2, w: 0.08, h: 0.3 })], 0.1, zone)
    expect(tall[0].cls).toBe('cattle')
  })

  it('ignores the shape of boxes cut by the frame edge when voting the class', () => {
    const tracker = new DetectionTracker()
    const zone = createDefaultSafeZone()
    tracker.update([blob({ x: 0.8, y: 0.6, w: 0.15, h: 0.12 })], 0, zone)
    let result = tracker.update([], 0, zone)
    for (let step = 1; step <= 10; step++) {
      result = tracker.update([blob({ x: 0.93, y: 0.55, w: 0.07, h: 0.2 })], step / 10, zone)
    }
    expect(result[0].cls).toBe('cattle')
    expect(result[0].outside).toBe(true)
  })

  it('reports a track only after it is confirmed and gives it the next visible id', () => {
    const tracker = new DetectionTracker(3)
    const zone = createDefaultSafeZone()
    tracker.update([blob({ x: 0.7, y: 0.7, w: 0.02, h: 0.05 })], 0, zone)
    const input = [blob({ x: 0.2, y: 0.3, w: 0.2, h: 0.12 })]
    expect(tracker.update(input, 0.1, zone)).toHaveLength(0)
    expect(tracker.update(input, 0.2, zone)).toHaveLength(0)
    const confirmed = tracker.update(input, 0.3, zone)
    expect(confirmed).toHaveLength(1)
    expect(confirmed[0].trackId).toBe('1')
  })

  it('retains an unseen track briefly and then discards it', () => {
    const tracker = new DetectionTracker()
    const zone = createDefaultSafeZone()
    const input = [blob({ x: 0.2, y: 0.3, w: 0.2, h: 0.12 })]
    tracker.update(input, 0, zone)
    const retained = tracker.update([], 0.5, zone)
    expect(retained).toHaveLength(1)
    expect(retained[0].confidence).toBeLessThan(0.9)
    expect(tracker.update([], 1.2, zone)).toHaveLength(0)
  })
})

describe('alerts and summary metrics', () => {
  it('counts outside transitions without repeating a continuous breach', () => {
    const counter = new AlertTransitionCounter()
    expect(counter.update([detection('3', false)], 0)).toEqual([])
    expect(counter.update([detection('3', true)], 1)).toEqual([{ track_id: '3', cls: 'cattle', time_sec: 1 }])
    expect(counter.update([detection('3', true)], 2)).toEqual([])
    expect(counter.update([detection('3', false)], 3)).toEqual([])
    expect(counter.update([detection('3', true)], 4)).toHaveLength(1)
  })

  it('ignores jitter on the zone line until the track was inside long enough', () => {
    const counter = new AlertTransitionCounter()
    expect(counter.update([detection('4', true)], 5)).toHaveLength(1)
    expect(counter.update([detection('4', false)], 5.1)).toEqual([])
    expect(counter.update([detection('4', true)], 5.2)).toEqual([])
    expect(counter.update([detection('4', false)], 6)).toEqual([])
    expect(counter.update([detection('4', true)], 6.6)).toHaveLength(1)
  })

  it('counts an initial outside detection and supports people alerts', () => {
    const counter = new AlertTransitionCounter()
    expect(counter.update([detection('5', true, 'person')], 2.5)).toEqual([
      { track_id: '5', cls: 'person', time_sec: 2.5 },
    ])
  })

  it('aggregates maxima, confidence and time-weighted outside ratio', () => {
    const metrics = new AnalysisMetrics()
    metrics.observe(frame(0, []))
    metrics.observe(frame(1, [detection('3', true)]))
    metrics.observe(frame(2, [detection('3', true), detection('5', false, 'person')]))
    metrics.observe(frame(3, [detection('3', false)]))
    const summary = metrics.finish('pasture.mp4', 3, [{ track_id: '3', cls: 'cattle', time_sec: 1 }])
    expect(summary).toEqual({
      video_name: 'pasture.mp4',
      duration_sec: 3,
      frames_analyzed: 4,
      max_cattle: 1,
      max_people: 1,
      alerts: [{ track_id: '3', cls: 'cattle', time_sec: 1 }],
      avg_confidence: 0.9,
      outside_ratio: 0.667,
    })
  })
})
