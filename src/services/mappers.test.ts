import { describe, expect, it } from 'vitest'
import { buildMockFarmEvents } from '../mocks/mockData'
import { isInsideZone, isPointInPolygon, isWithinBounds, toFarmEvent } from './mappers'

describe('toFarmEvent', () => {
  it('maps backend fields, parses dates and assigns catalog severity', () => {
    const event = buildMockFarmEvents().find(item => item.kind === 'cattle_out_of_zone')!
    if (event.detectedObject === null || event.confidence === null) throw new Error('Cattle events require detection data')
    expect(toFarmEvent({
      id: event.id, event_type: 'cattle_out_of_zone', camera_id: event.cameraId,
      detected_object: event.detectedObject, confidence: event.confidence,
      timestamp: event.occurredAt.toISOString(), received_at: event.receivedAt.toISOString(),
    })).toEqual({ ...event, severity: 'warning', severitySource: 'catalog' })
  })
})

describe('isWithinBounds', () => {
  it.each([
    [{ x: 0, y: 0, width: 0.5, height: 0.25 }, true],
    [{ x: 0.5, y: 0.5, width: 0.5, height: 0.25 }, true],
    [{ x: 0.24, y: 0.3, width: 0, height: 0.1 }, false],
    [{ x: 0.76, y: 0.3, width: 0, height: 0.1 }, false],
    [{ x: 0.3, y: 0.1, width: 0.1, height: 0.1 }, false],
    [{ x: 0.3, y: 0.7, width: 0.1, height: 0.1 }, false],
    [{ x: 0, y: 0, width: 1, height: 0.5 }, true],
  ] as const)('checks the bottom-center point of %o, including boundaries', (box, expected) => {
    expect(isWithinBounds(box, [0.25, 0.25, 0.75, 0.75])).toBe(expected)
  })
})

describe('zone polygons', () => {
  // A trapezoid wider at the bottom.
  const outline = [[0.3, 0.2], [0.7, 0.2], [0.9, 0.8], [0.1, 0.8]] as const

  it('detects points inside and outside a polygon', () => {
    expect(isPointInPolygon([0.5, 0.5], outline)).toBe(true)
    expect(isPointInPolygon([0.15, 0.25], outline)).toBe(false)
    expect(isPointInPolygon([0.95, 0.5], outline)).toBe(false)
  })

  it('uses the outline when the zone has one, otherwise the bounds', () => {
    const box = { x: 0.1, y: 0.1, width: 0.1, height: 0.15 } // bottom-center (0.15, 0.25)
    const base = { id: 'z', cameraId: 'c', name: 'Z', bounds: [0.1, 0.2, 0.9, 0.8] as const }
    expect(isInsideZone(box, base)).toBe(true)
    expect(isInsideZone(box, { ...base, outline })).toBe(false)
  })
})
