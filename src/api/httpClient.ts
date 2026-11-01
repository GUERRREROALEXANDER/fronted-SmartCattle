import { apiBaseUrl, normalizeBaseUrl } from './config'
import { ApiError } from './errors'
import { tokenStore } from './session'

export interface GetJsonOptions {
  signal?: AbortSignal
  timeoutMs?: number
  baseUrl?: string
  fetchImpl?: typeof fetch
  /** Bearer token; defaults to the signed-in session's. `null` sends none. */
  token?: string | null
  /** Query parameters; undefined and null values are left out. */
  query?: Record<string, string | number | boolean | null | undefined>
}

export interface RequestJsonOptions extends GetJsonOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
}

function buildUrl(baseUrl: string, path: string, query: GetJsonOptions['query']): string {
  const url = `${normalizeBaseUrl(baseUrl)}/${path.replace(/^\/+/, '')}`
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(query ?? {})) {
    if (value !== undefined && value !== null) params.set(key, String(value))
  }
  const search = params.toString()
  return search ? `${url}?${search}` : url
}

function errorDetail(body: unknown): string | undefined {
  if (!body || typeof body !== 'object' || !('detail' in body)) return undefined
  const { detail } = body
  if (typeof detail === 'string') return detail
  // FastAPI validation errors: [{ msg, loc }]; the first message is enough for a person.
  if (Array.isArray(detail) && detail[0] && typeof detail[0] === 'object' && typeof detail[0].msg === 'string') return detail[0].msg
  return undefined
}

/** One JSON request to the backend, with timeout, abort, bearer token and typed errors. */
export async function requestJson<T>(path: string, options: RequestJsonOptions = {}): Promise<T> {
  const { signal, timeoutMs = 8000, baseUrl = apiBaseUrl, fetchImpl = fetch, method = 'GET', body, query } = options
  const token = options.token === undefined ? tokenStore.get() : options.token
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

  const headers: Record<string, string> = {}
  if (token) headers.Authorization = `Bearer ${token}`
  if (body !== undefined) headers['Content-Type'] = 'application/json'
  const init: RequestInit = { method, signal: controller.signal }
  if (Object.keys(headers).length > 0) init.headers = headers
  if (body !== undefined) init.body = JSON.stringify(body)

  const request = async (): Promise<T> => {
    let response: Response
    try {
      response = await fetchImpl(buildUrl(baseUrl, path, query), init)
    } catch {
      if (aborted) throw abortReason
      throw new ApiError('network', 'Network request failed')
    }
    if (!response.ok) {
      let detail: string | undefined
      try {
        detail = errorDetail(await response.json())
      } catch {
        if (aborted) throw abortReason
        // An unreadable error body does not change the HTTP error kind.
      }
      // An expired or revoked token signs the person out everywhere at once.
      if (response.status === 401 && token) tokenStore.reject()
      const retryAfter = Number(response.headers?.get?.('Retry-After'))
      throw new ApiError('http', `HTTP request failed with status ${response.status}`, {
        status: response.status, detail, retryAfterMs: Number.isFinite(retryAfter) && retryAfter > 0 ? retryAfter * 1000 : undefined,
      })
    }
    if (response.status === 204) return undefined as T
    try {
      return await response.json() as T
    } catch {
      if (aborted) throw abortReason
      throw new ApiError('parse', 'Response contains invalid JSON')
    }
  }

  try {
    return await Promise.race([request(), cancellation])
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

export function getJson<T>(path: string, options: GetJsonOptions = {}): Promise<T> {
  return requestJson<T>(path, { ...options, method: 'GET' })
}

export function postJson<T>(path: string, body?: unknown, options: GetJsonOptions = {}): Promise<T> {
  return requestJson<T>(path, { ...options, method: 'POST', body })
}
