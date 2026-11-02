import { describe, expect, it } from 'vitest'
import { parseZone, parseZonesResponse } from './validate'

const zone = {
  id: 1, camera_id: 'camera-01', name: 'Safe zone',
  x_min: 0.1, y_min: 0.1, x_max: 0.9, y_max: 0.9,
  outline: null, active: true, created_at: '2026-10-01T08:00:00Z',
}

describe('parseZone', () => {
  it('accepts a rectangle', () => {
    expect(parseZone(zone)).toEqual(zone)
  })

  it('accepts a polygon', () => {
    const polygon = [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.3 }, { x: 0.5, y: 0.7 }]
    expect(parseZone({ ...zone, outline: polygon }).outline).toEqual(polygon)
  })

  it('treats an absent outline as none', () => {
    const withoutOutline: Record<string, unknown> = { ...zone }
    delete withoutOutline.outline
    expect(parseZone(withoutOutline).outline).toBeNull()
  })

  it.each([
    ['an inverted rectangle', { x_min: 0.9, y_min: 0.9, x_max: 0.1, y_max: 0.1 }],
    ['a flat rectangle', { x_min: 0.5, x_max: 0.5 }],
  ])('rejects %s', (_label, corners) => {
    // Corners the wrong way round make the whole frame read as outside the
    // zone, so every visible animal raises an alert and it looks like the
    // detector broke. The backend refuses it; refusing it here means a
    // database written before that constraint cannot produce the same flood.
    expect(() => parseZone({ ...zone, ...corners })).toThrowError(
      expect.objectContaining({ kind: 'parse' }),
    )
  })

  it.each([
    ['a coordinate above one', { x_max: 1.4 }],
    ['a negative coordinate', { x_min: -0.1 }],
    ['a non-numeric coordinate', { x_min: '0.1' }],
    ['no camera', { camera_id: '' }],
    ['no name', { name: '' }],
    ['a non-integer id', { id: 1.5 }],
    ['a missing active flag', { active: undefined }],
    ['an unparseable timestamp', { created_at: 'nope' }],
  ])('rejects %s', (_label, invalid) => {
    expect(() => parseZone({ ...zone, ...invalid })).toThrowError(
      expect.objectContaining({ kind: 'parse' }),
    )
  })

  it.each([
    ['two vertices', [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.8 }]],
    ['a vertex out of range', [{ x: 0.2, y: 0.2 }, { x: 1.4, y: 0.3 }, { x: 0.5, y: 0.7 }]],
    ['a vertex missing y', [{ x: 0.2 }, { x: 0.8, y: 0.3 }, { x: 0.5, y: 0.7 }]],
    ['a coordinate as text', [{ x: '0.2', y: 0.2 }, { x: 0.8, y: 0.3 }, { x: 0.5, y: 0.7 }]],
    ['not an array', { x: 0.2, y: 0.2 }],
  ])('rejects an outline with %s', (_label, outline) => {
    // Rejected rather than dropped. A dropped polygon still renders, from the
    // bounding box, and silently covers different ground than the one drawn.
    expect(() => parseZone({ ...zone, outline })).toThrowError(
      expect.objectContaining({ kind: 'parse' }),
    )
  })
})

describe('parseZonesResponse', () => {
  it('parses a list', () => {
    expect(parseZonesResponse({ items: [zone], total: 1 })).toEqual({ items: [zone], total: 1 })
  })

  it.each([
    ['no items', { total: 0 }],
    ['a non-numeric total', { items: [], total: 'two' }],
    ['one invalid zone', { items: [zone, { ...zone, x_max: 0.05 }], total: 2 }],
  ])('rejects a response with %s', (_label, body) => {
    expect(() => parseZonesResponse(body)).toThrowError(expect.objectContaining({ kind: 'parse' }))
  })
})
