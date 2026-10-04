import { afterEach, expect, it, vi } from 'vitest'
import { createSafeStorage } from './safeStorage'

afterEach(() => vi.unstubAllGlobals())

it('falls back when accessing localStorage throws', () => {
  const storage = createSafeStorage(() => { throw new Error('Blocked') })
  storage.setJson('session', { id: 'demo' })
  expect(storage.getJson('session')).toEqual({ id: 'demo' })
  storage.remove('session')
  expect(storage.getJson('session')).toBeNull()
})

it.each(['getItem', 'setItem', 'removeItem'] as const)('falls back when %s throws without restoring stale data', method => {
  const data = new Map<string, string>()
  const local = {
    getItem: vi.fn((key: string) => data.get(key) ?? null),
    setItem: vi.fn((key: string, value: string) => { data.set(key, value) }),
    removeItem: vi.fn((key: string) => { data.delete(key) }),
  }
  vi.stubGlobal('localStorage', local)
  const storage = createSafeStorage()
  storage.setJson('session', { id: 'old' })
  local[method].mockImplementation(() => { throw new Error('Blocked') })
  if (method === 'getItem') expect(storage.getJson('session')).toEqual({ id: 'old' })
  if (method === 'setItem') storage.setJson('session', { id: 'new' })
  storage.remove('session')
  expect(storage.getJson('session')).toBeNull()
  storage.setJson('session', { id: 'latest' })
  expect(storage.getJson('session')).toEqual({ id: 'latest' })
})

it('returns null for invalid JSON in persistent storage', () => {
  vi.stubGlobal('localStorage', { getItem: () => 'invalid JSON' })
  expect(createSafeStorage().getJson('session')).toBeNull()
})
