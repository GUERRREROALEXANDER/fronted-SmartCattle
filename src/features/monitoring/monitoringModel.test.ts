import { describe, expect, it } from 'vitest'
import type { Camera, Detection, FarmEvent } from '../../types/domain'
import { detectionSummaryText, pickCamera, placeLabels, stageState, summarizeDetections } from './monitoringModel'

const camera = (id: string, status: Camera['status'] = 'online'): Camera => ({ id, name: id, location: '', status, lastSeenAt: null })
const cameras = [camera('a'), camera('b'), camera('c')]
const alert = { cameraId: 'b' } as FarmEvent
const detection = (label: string, insideSafeZone: boolean | null): Detection =>
  ({ id: label, label, confidence: 0.9, box: { x: 0, y: 0, width: 0.1, height: 0.1 }, insideSafeZone })

describe('monitoringModel', () => {
  it('picks the requested camera, then the alert camera, then the first', () => {
    expect(pickCamera(cameras, 'c', [alert])?.id).toBe('c')
    expect(pickCamera(cameras, 'missing', [alert])?.id).toBe('b')
    expect(pickCamera(cameras, null, [])?.id).toBe('a')
    expect(pickCamera([], 'a', [])).toBeNull()
  })

  it('summarizes detections by class and zone', () => {
    const summary = summarizeDetections([detection('cow', true), detection('cow', false), detection('person', null), detection('vehicle', true)])
    expect(summary).toEqual({ cattle: 2, people: 1, other: 1, outside: 1 })
    expect(detectionSummaryText(summary)).toBe('2 bovinos · 1 persona · 1 otro objeto')
    expect(detectionSummaryText({ cattle: 1, people: 0, other: 0, outside: 0 })).toBe('1 bovino · 0 personas')
  })

  it('moves colliding labels below their box', () => {
    const at = (id: string, x: number, y: number): Detection => ({ ...detection('cow', true), id, box: { x, y, width: 0.05, height: 0.1 } })
    const placement = placeLabels([at('c', 0.40, 0.3), at('a', 0.10, 0.3), at('b', 0.15, 0.31), at('d', 0.42, 0.6)])
    expect(Object.fromEntries(placement)).toEqual({ a: 'above', b: 'below', c: 'above', d: 'above' })
  })

  it('derives the stage state from camera status and stream', () => {
    const image = { kind: 'image', url: 'x', width: 1, height: 1, synthetic: true } as const
    expect(stageState(null, image, false)).toBe('loading')
    expect(stageState(camera('a'), image, true)).toBe('loading')
    expect(stageState(camera('a', 'offline'), image, false)).toBe('offline')
    expect(stageState(camera('a', 'error'), image, false)).toBe('error')
    expect(stageState(camera('a', 'connecting'), image, false)).toBe('connecting')
    expect(stageState(camera('a'), { kind: 'none' }, false)).toBe('no-stream')
    expect(stageState(camera('a'), null, false)).toBe('no-stream')
    expect(stageState(camera('a'), { kind: 'hls', url: 'x' }, false)).toBe('unsupported')
    expect(stageState(camera('a'), image, false)).toBe('live')
  })
})
