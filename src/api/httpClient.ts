import { apiBaseUrl, normalizeBaseUrl } from './config'
import { ApiError } from './errors'

export type HttpMethod = 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE'

export interface RequestOptions {
  signal?: AbortSignal
  timeoutMs?: number
  baseUrl?: string
  fetchImpl?: typeof fetch
  /** Sent as JSON. Omitted for GET and DELETE, which carry no body. */
  body?: unknown
  /** Merged over the defaults. Used for Authorization. */
  headers?: Record<string, string>
}

export interface GetJsonOptions extends Omit<RequestOptions, 'body'> {}

/** Reads `detail` out of a FastAPI error body, whatever shape it came in. */
function errorDetail(body: unknown): string | undefined {
  if (!body || typeof body !== 'object' || !('detail' in body)) return undefined
  const { detail } = body as { detail: unknown }
  if (typeof detail === 'string') return detail
  // 422 returns an array of per-field errors. The first message is the one
  // worth showing; the rest repeat the shape.
  if (Array.isArray(detail)) {
    const first = detail.find(item => item && typeof item === 'object' && 'msg' in item)
    const msg = first && (first as { msg?: unknown }).msg
    return typeof msg === 'string' ? msg : undefined
  }
  return undefined
}

/**
 * One request, with the cancellation and timeout handling every caller needs.
 *
 * Previously this only did GET, with `method` hardcoded, so the first POST in
 * the app reimplemented the abort wiring, the timeout and the error mapping in
 * `videoAnalysisService`. Two copies of this logic is two places for a
 * cancellation bug to live.
 */
export async function request<T>(
  method: HttpMethod,
  path: string,
  options: RequestOptions = {},
): Promise<T> {
  const {
    signal, timeoutMs = 8000, baseUrl = apiBaseUrl, fetchImpl = fetch, body, headers,
  } = options
  signal?.throwIfAborted()
  const controller = new AbortController()
  let abortReason: unknown
  let aborted = false
  let rejectAbort: (reason: unknown) => void = () => {}
  const cancellation = new Promise<never>((_, reject) => { rejectAbort = reject })
  const abort = (reason: unknown) => {
    if (aborted) return
    aborted = true
    abortReason = reason
    rejectAbort(reason)
    controller.abort(reason)
  }
  const onAbort = () => abort(signal?.reason)
  signal?.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(() => abort(new ApiError('timeout', 'Request timed out')), timeoutMs)

  const hasBody = body !== undefined && method !== 'GET' && method !== 'DELETE'

  const send = async (): Promise<T> => {
    let response: Response
    try {
      response = await fetchImpl(`${normalizeBaseUrl(baseUrl)}/${path.replace(/^\/+/, '')}`, {
        method,
        signal: controller.signal,
        ...(hasBody ? { body: JSON.stringify(body) } : {}),
        headers: {
          ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
          ...headers,
        },
      })
    } catch {
      if (aborted) throw abortReason
      throw new ApiError('network', 'Network request failed')
    }
    if (!response.ok) {
      let detail: string | undefined
      try {
        detail = errorDetail(await response.json() as unknown)
      } catch {
        if (aborted) throw abortReason
        // An unreadable error body does not change the HTTP error kind.
      }
      throw new ApiError('http', `HTTP request failed with status ${response.status}`, { status: response.status, detail })
    }
    // 204 has no body, and response.json() on an empty body throws. A caller
    // expecting nothing gets undefined rather than a parse error.
    if (response.status === 204) return undefined as T
    try {
      return await response.json() as T
    } catch {
      if (aborted) throw abortReason
      throw new ApiError('parse', 'Response contains invalid JSON')
    }
  }

  try {
    return await Promise.race([send(), cancellation])
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

export function getJson<T>(path: string, options: GetJsonOptions = {}): Promise<T> {
  return request<T>('GET', path, options)
}

export function postJson<T>(path: string, body: unknown, options: GetJsonOptions = {}): Promise<T> {
  return request<T>('POST', path, { ...options, body })
}

export function patchJson<T>(path: string, body: unknown, options: GetJsonOptions = {}): Promise<T> {
  return request<T>('PATCH', path, { ...options, body })
}

export function putJson<T>(path: string, body: unknown, options: GetJsonOptions = {}): Promise<T> {
  return request<T>('PUT', path, { ...options, body })
}

export function deleteJson<T>(path: string, options: GetJsonOptions = {}): Promise<T> {
  return request<T>('DELETE', path, options)
}
