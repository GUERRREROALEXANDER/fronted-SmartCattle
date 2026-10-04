import { afterEach, expect, it, vi } from 'vitest'
import { mockDelay, resolveSource } from './dataSource'

afterEach(() => vi.useRealTimers())

it.each([
  ['backend', 'api', 'api'], ['backend', 'hybrid', 'api'], ['backend', 'mock', 'mock'],
  ['mock-only', 'api', 'unavailable'], ['mock-only', 'hybrid', 'mock'], ['mock-only', 'mock', 'mock'],
] as const)('resolves %s in %s mode to %s', (capability, mode, expected) => {
  expect(resolveSource(capability, mode)).toBe(expected)
})

it('delays mock resolution for 250 ms by default', async () => {
  vi.useFakeTimers()
  const complete = vi.fn()
  const pending = mockDelay().then(complete)
  await vi.advanceTimersByTimeAsync(249)
  expect(complete).not.toHaveBeenCalled()
  await vi.advanceTimersByTimeAsync(1)
  await pending
  expect(complete).toHaveBeenCalledOnce()
})
