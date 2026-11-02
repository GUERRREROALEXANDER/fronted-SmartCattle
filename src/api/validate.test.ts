import { expect, it, vi } from 'vitest'
import { parseAnimalsResponse, parseEventsResponse, parseStatusResponse, isHealthy } from './validate'

const event = { id: 'e1', event_type: 'cattle_out_of_zone', camera_id: 'c1', detected_object: 'cow', confidence: 0.9,
  timestamp: '2026-10-05T10:00:00Z', received_at: '2026-10-05T10:00:01Z', level: 'high' }

it('parses valid events', () => {
  expect(parseEventsResponse({ items: [event], total: 1 })).toEqual({ items: [event], total: 1 })
})
it('rejects missing event items', () => {
  expect(() => parseEventsResponse({ total: 1 })).toThrowError(expect.objectContaining({ kind: 'parse' }))
})
it('rejects invalid event dates', () => {
  expect(() => parseEventsResponse({ items: [{ ...event, timestamp: 'invalid' }], total: 1 })).toThrowError(expect.objectContaining({ kind: 'parse' }))
})
it('drops unknown event types and warns once', () => {
  const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
  try {
    expect(parseEventsResponse({ items: [{ ...event, event_type: 'new_event' }, event], total: 2 }).items).toEqual([event])
    expect(warn).toHaveBeenCalledOnce()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('new_event'))
  } finally { warn.mockRestore() }
})
it('accepts an empty animal list', () => {
  expect(parseAnimalsResponse({ items: [], total: 0 })).toEqual({ items: [], total: 0 })
})
it('validates status and health', () => {
  expect(isHealthy({ status: 'ok' })).toBe(true)
  expect(isHealthy({ status: 'down' })).toBe(false)
  expect(() => parseStatusResponse({ status: 'ok', version: 1 })).toThrowError(expect.objectContaining({ kind: 'parse' }))
})

it('defaults a missing severity to medium', () => {
  // A backend predating the severity column sends no level. Medium is the
  // default that column has always carried, so the feed keeps working instead
  // of failing over a field this app can live without.
  const withoutLevel: Record<string, unknown> = { ...event }
  delete withoutLevel.level
  expect(parseEventsResponse({ items: [withoutLevel], total: 1 }).items[0].level).toBe('medium')
})

it('defaults an unknown severity to medium', () => {
  expect(parseEventsResponse({ items: [{ ...event, level: 'urgentisimo' }], total: 1 }).items[0].level)
    .toBe('medium')
})

it('keeps a severity it recognises', () => {
  for (const level of ['low', 'medium', 'high']) {
    expect(parseEventsResponse({ items: [{ ...event, level }], total: 1 }).items[0].level).toBe(level)
  }
})

it('parses an animal with its nullable fields', () => {
  const animal = {
    tag: 'A-441', name: 'Lucera', status: 'active', camera_id: 'camera-01',
    last_detection: '2026-10-29T12:00:00Z',
    created_at: '2026-10-01T08:00:00Z', updated_at: '2026-10-29T12:00:00Z',
  }
  expect(parseAnimalsResponse({ items: [animal], total: 1 })).toEqual({ items: [animal], total: 1 })
})

it('reads an unlocated, never detected animal', () => {
  // Both nulls are meaningful: nobody has located it, and it has never been
  // seen. These are the animals most worth looking at, so they must parse.
  const animal = {
    tag: 'A-900', name: null, status: 'active', camera_id: null, last_detection: null,
    created_at: '2026-10-01T08:00:00Z', updated_at: '2026-10-01T08:00:00Z',
  }
  expect(parseAnimalsResponse({ items: [animal], total: 1 }).items[0]).toEqual(animal)
})

it('treats omitted animal fields as null', () => {
  // An older backend omitted them rather than sending null.
  const animal = {
    tag: 'A-901', status: 'lost',
    created_at: '2026-10-01T08:00:00Z', updated_at: '2026-10-01T08:00:00Z',
  }
  expect(parseAnimalsResponse({ items: [animal], total: 1 }).items[0]).toMatchObject({
    name: null, camera_id: null, last_detection: null,
  })
})

it.each([
  ['no tag', { status: 'active' }],
  ['an empty tag', { tag: '', status: 'active' }],
  ['an unknown status', { tag: 'A-1', status: 'vendida' }],
  ['no timestamps', { tag: 'A-1', status: 'active' }],
  ['an unparseable timestamp', { tag: 'A-1', status: 'active', created_at: 'nope', updated_at: 'nope' }],
])('rejects an animal with %s', (_label, animal) => {
  expect(() => parseAnimalsResponse({ items: [animal], total: 1 }))
    .toThrowError(expect.objectContaining({ kind: 'parse' }))
})
