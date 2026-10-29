import { afterEach, describe, expect, it, vi } from 'vitest'
import { deleteJson, getJson, postJson } from './httpClient'
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

describe('request', () => {
  const init = (fetchImpl: ReturnType<typeof vi.fn<typeof fetch>>) =>
    fetchImpl.mock.calls[0][1] as RequestInit

  it('sends a JSON body on POST with the content type', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ id: 1 }))
    await postJson('/api/animals', { tag: 'A-441' }, { fetchImpl, baseUrl: 'http://api.test' })

    expect(fetchImpl.mock.calls[0][0]).toBe('http://api.test/api/animals')
    expect(init(fetchImpl).method).toBe('POST')
    expect(init(fetchImpl).body).toBe(JSON.stringify({ tag: 'A-441' }))
    expect(new Headers(init(fetchImpl).headers).get('content-type')).toBe('application/json')
  })

  it('does not send a body or a content type on GET', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ items: [] }))
    await getJson('/api/animals', { fetchImpl })

    expect(init(fetchImpl).body).toBeUndefined()
    expect(init(fetchImpl).headers).toBeUndefined()
  })

  it('merges the caller headers, which is how Authorization arrives', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ ok: true }))
    await getJson('/api/auth/me', { fetchImpl, headers: { Authorization: 'Bearer t' } })

    expect(new Headers(init(fetchImpl).headers).get('authorization')).toBe('Bearer t')
  })

  it('returns undefined for 204 instead of failing to parse', async () => {
    // DELETE answers 204. response.json() on an empty body throws, so a
    // caller expecting nothing would have seen a parse error.
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    await expect(deleteJson('/api/zones/1', { fetchImpl })).resolves.toBeUndefined()
  })

  it('reads the detail out of a FastAPI validation error', async () => {
    // 422 returns an array of per-field objects, not a string. Those were the
    // responses whose message was dropped -- the ones with something to say.
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ detail: [{ loc: ['body', 'tag'], msg: 'String too short' }] }, { status: 422 }),
    )
    await expect(postJson('/api/animals', {}, { fetchImpl })).rejects.toMatchObject({
      kind: 'http', status: 422, detail: 'String too short',
    })
  })

  it('still reads a plain string detail', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ detail: 'That email is already registered' }, { status: 409 }),
    )
    await expect(postJson('/api/auth/register', {}, { fetchImpl })).rejects.toMatchObject({
      status: 409, detail: 'That email is already registered',
    })
  })

  it('ignores a 422 body whose entries carry no message', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(
      Response.json({ detail: [{ loc: ['body'] }] }, { status: 422 }),
    )
    await expect(postJson('/api/animals', {}, { fetchImpl })).rejects.toMatchObject({
      kind: 'http', status: 422, detail: undefined,
    })
  })

  it('propagates the caller reason when the signal aborts', async () => {
    const controller = new AbortController()
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(() => new Promise(() => {}))
    const pending = postJson('/api/animals', { tag: 'A-1' }, {
      fetchImpl, signal: controller.signal,
    })
    controller.abort(new Error('route changed'))
    await expect(pending).rejects.toThrow('route changed')
  })

  it('refuses a request whose signal is already aborted', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const controller = new AbortController()
    controller.abort(new Error('already gone'))
    await expect(postJson('/api/animals', {}, { fetchImpl, signal: controller.signal })).rejects.toThrow()
    // And never reached the network.
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})
