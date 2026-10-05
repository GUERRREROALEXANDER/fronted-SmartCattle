import { expect, it, vi } from 'vitest'
import { parseAnimalsResponse, parseEventsResponse, parseStatusResponse, isHealthy } from './validate'

const event = { id: 'e1', event_type: 'cattle_out_of_zone', camera_id: 'c1', detected_object: 'cow', confidence: 0.9,
  timestamp: '2026-10-05T10:00:00Z', received_at: '2026-10-05T10:00:01Z' }

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
