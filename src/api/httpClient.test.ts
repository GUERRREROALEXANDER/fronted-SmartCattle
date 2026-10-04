import { afterEach, describe, expect, it, vi } from 'vitest'
import { getJson } from './httpClient'
import { ApiError } from './errors'

afterEach(() => vi.useRealTimers())

describe('getJson', () => {
  it('returns JSON and uses GET with a normalized URL', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ status: 'ok' }))
    await expect(getJson('/health', { fetchImpl, baseUrl: 'http://localhost:8000///' })).resolves.toEqual({ status: 'ok' })
    expect(fetchImpl).toHaveBeenCalledWith('http://localhost:8000/health', { method: 'GET', signal: expect.any(AbortSignal) })
  })
  it('includes HTTP status and string detail', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ detail: 'Unavailable' }, { status: 503 }))
    await expect(getJson('/health', { fetchImpl })).rejects.toMatchObject({ kind: 'http', status: 503, detail: 'Unavailable' })
  })
  it.each([Response.json({ detail: { message: 'Unavailable' } }, { status: 503 }), new Response('invalid', { status: 503 })])('preserves HTTP errors without string detail', async response => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response)
    await expect(getJson('/health', { fetchImpl })).rejects.toMatchObject({ kind: 'http', status: 503, detail: undefined })
  })
  it('maps fetch rejection to a network error', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockRejectedValue(new TypeError('Failed to fetch'))
    await expect(getJson('/health', { fetchImpl })).rejects.toMatchObject({ kind: 'network' })
  })
  it('maps invalid JSON to a parse error', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response('invalid'))
    await expect(getJson('/health', { fetchImpl })).rejects.toMatchObject({ kind: 'parse' })
  })
  it('aborts with the default timeout even when a fetch stub ignores cancellation', async () => {
    vi.useFakeTimers()
    let requestSignal: AbortSignal | null | undefined
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation((_input, init) => {
      requestSignal = init?.signal
      return new Promise(() => {})
    })
    const assertion = expect(getJson('/health', { fetchImpl })).rejects.toMatchObject({ kind: 'timeout' })
    await vi.advanceTimersByTimeAsync(8000)
    await assertion
    expect(requestSignal?.aborted).toBe(true)
    expect(vi.getTimerCount()).toBe(0)
  })
  it('applies the timeout while reading the response body', async () => {
    vi.useFakeTimers()
    const response = new Response()
    vi.spyOn(response, 'json').mockImplementation(() => new Promise(() => {}))
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(response)
    const assertion = expect(getJson('/health', { fetchImpl, timeoutMs: 10 })).rejects.toBeInstanceOf(ApiError)
    await vi.advanceTimersByTimeAsync(10)
    await assertion
  })
  it('preserves caller abort identity and cleans up the timeout', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const reason = new DOMException('Caller cancelled', 'AbortError')
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}))
    const assertion = expect(getJson('/health', { fetchImpl, signal: controller.signal })).rejects.toBe(reason)
    controller.abort(reason)
    await assertion
    expect(vi.getTimerCount()).toBe(0)
  })
  it('does not fetch when the caller signal is already aborted', async () => {
    const controller = new AbortController()
    controller.abort()
    const fetchImpl = vi.fn<typeof fetch>()
    await expect(getJson('/health', { fetchImpl, signal: controller.signal })).rejects.toBe(controller.signal.reason)
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
