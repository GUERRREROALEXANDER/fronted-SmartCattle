import { apiBaseUrl, dataMode, normalizeBaseUrl, type DataMode } from '../api/config'
import { ApiError } from '../api/errors'
import { safeStorage } from '../lib/safeStorage'
import { resolveSource } from './dataSource'

// Contract of POST /api/videos/analyses (backend app/schemas/video_analysis.py).
export interface VideoAnalysisPayload {
  video_name: string
  duration_sec: number
  frames_analyzed: number
  max_cattle: number
  max_people: number
  alerts: { track_id: number; cls: 'cattle' | 'person'; time_sec: number }[]
  avg_confidence: number
  outside_ratio: number
}

export interface StoredVideoAnalysis extends VideoAnalysisPayload {
  id: string
  created_at: string
  alert_count: number
}

export type SaveTarget = 'api' | 'local'

export interface SaveAnalysisResult {
  target: SaveTarget
  analysis: StoredVideoAnalysis
}

export interface SaveAnalysisOptions {
  mode?: DataMode
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  baseUrl?: string
  timeoutMs?: number
  now?: Date
}

const LOCAL_KEY = 'smartcattle.videos.analyses'
const LOCAL_LIMIT = 20

export function listLocalAnalyses(): StoredVideoAnalysis[] {
  const stored = safeStorage.getJson<StoredVideoAnalysis[]>(LOCAL_KEY)
  return Array.isArray(stored) ? stored : []
}

function keepLocally(payload: VideoAnalysisPayload, now: Date): StoredVideoAnalysis {
  const analysis: StoredVideoAnalysis = {
    ...payload,
    id: typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `local-${now.getTime()}`,
    created_at: now.toISOString(),
    alert_count: payload.alerts.length,
  }
  safeStorage.setJson(LOCAL_KEY, [analysis, ...listLocalAnalyses()].slice(0, LOCAL_LIMIT))
  return analysis
}

async function postAnalysis(payload: VideoAnalysisPayload, options: SaveAnalysisOptions): Promise<StoredVideoAnalysis> {
  const { signal, fetchImpl = fetch, baseUrl = apiBaseUrl, timeoutMs = 8000 } = options
  const controller = new AbortController()
  const onAbort = () => controller.abort(signal?.reason)
  signal?.addEventListener('abort', onAbort, { once: true })
  const timer = setTimeout(() => controller.abort(new ApiError('timeout', 'Request timed out')), timeoutMs)
  try {
    let response: Response
    try {
      response = await fetchImpl(`${normalizeBaseUrl(baseUrl)}/api/videos/analyses`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
        signal: controller.signal,
      })
    } catch {
      if (signal?.aborted) throw signal.reason
      if (controller.signal.aborted) throw new ApiError('timeout', 'Request timed out')
      throw new ApiError('network', 'Network request failed')
    }
    if (!response.ok) throw new ApiError('http', `HTTP request failed with status ${response.status}`, { status: response.status })
    try {
      return await response.json() as StoredVideoAnalysis
    } catch {
      throw new ApiError('parse', 'Response contains invalid JSON')
    }
  } finally {
    clearTimeout(timer)
    signal?.removeEventListener('abort', onAbort)
  }
}

/**
 * Saves a finished video analysis. In mock mode, or when the backend cannot be reached or rejects
 * the request, the summary is kept in this browser so the evaluator never loses the result.
 */
export async function saveAnalysis(payload: VideoAnalysisPayload, options: SaveAnalysisOptions = {}): Promise<SaveAnalysisResult> {
  const now = options.now ?? new Date()
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source !== 'api') return { target: 'local', analysis: keepLocally(payload, now) }
  try {
    return { target: 'api', analysis: await postAnalysis(payload, options) }
  } catch (error) {
    if (options.signal?.aborted) throw error
    return { target: 'local', analysis: keepLocally(payload, now) }
  }
}
