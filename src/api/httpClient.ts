import { apiBaseUrl, normalizeBaseUrl } from './config'
import { ApiError } from './errors'

export interface GetJsonOptions {
  signal?: AbortSignal
  timeoutMs?: number
  baseUrl?: string
  fetchImpl?: typeof fetch
}

export async function getJson<T>(path: string, options: GetJsonOptions = {}): Promise<T> {
  const { signal, timeoutMs = 8000, baseUrl = apiBaseUrl, fetchImpl = fetch } = options
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

  const request = async (): Promise<T> => {
    let response: Response
    try {
      response = await fetchImpl(`${normalizeBaseUrl(baseUrl)}/${path.replace(/^\/+/, '')}`, {
        method: 'GET', signal: controller.signal,
      })
    } catch {
      if (aborted) throw abortReason
      throw new ApiError('network', 'Network request failed')
    }
    if (!response.ok) {
      let detail: string | undefined
      try {
        const body: unknown = await response.json()
        if (body && typeof body === 'object' && 'detail' in body && typeof body.detail === 'string') {
          detail = body.detail
        }
      } catch {
        if (aborted) throw abortReason
        // An unreadable error body does not change the HTTP error kind.
      }
      throw new ApiError('http', `HTTP request failed with status ${response.status}`, { status: response.status, detail })
    }
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
