import { describe, expect, it } from 'vitest'
import { buildMockFarmEvents } from '../../mocks/mockData'
import type { Camera, Detection, FrameDetections } from '../../types/domain'
import { cattleEvents, herdByCamera, visibleTotals } from './cattleModel'

const camera = (id: string): Camera => ({ id, name: id, location: '', status: 'online', lastSeenAt: null })
const detection = (label: string, inside: boolean): Detection =>
  ({ id: `${label}-${inside}-${Math.random()}`, label, confidence: 0.9, box: { x: 0, y: 0, width: 0.1, height: 0.1 }, insideSafeZone: inside })
const frame = (cameraId: string, detections: Detection[]): FrameDetections => ({ cameraId, capturedAt: new Date(0), detections })

describe('cattleModel', () => {
  it('counts visible and outside cattle per camera, ignoring people and cameras without a picture', () => {
    const rows = herdByCamera(
      [camera('a'), camera('b'), camera('c')],
      { a: frame('a', [detection('cow', true), detection('cow', false), detection('person', false)]), b: frame('b', [detection('cow', true)]), c: null },
      id => id !== 'b',
    )
    expect(rows.map(row => [row.camera.id, row.visible, row.outside])).toEqual([['a', 2, 1], ['b', null, null], ['c', null, null]])
    expect(visibleTotals(rows)).toEqual({ visible: 2, outside: 1, analyzed: 1 })
  })

  it('keeps only cattle events', () => {
    const kinds = new Set(cattleEvents(buildMockFarmEvents()).map(event => event.kind))
    expect(kinds).toEqual(new Set(['cattle_out_of_zone', 'external_animal_detected']))
  })
})
