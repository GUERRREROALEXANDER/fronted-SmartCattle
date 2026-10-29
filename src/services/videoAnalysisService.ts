import { dataMode, type DataMode } from '../api/config'
import { postJson } from '../api/httpClient'
import { authHeaders } from '../api/session'
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
  /** Overrides the Authorization header read from the stored session. */
  headers?: Record<string, string>
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

async function postAnalysis(
  payload: VideoAnalysisPayload,
  options: SaveAnalysisOptions,
): Promise<StoredVideoAnalysis> {
  // Through the shared client rather than its own fetch. This function used to
  // reimplement the abort wiring, the timeout and the error mapping, which
  // meant two copies of cancellation logic and only one of them had the
  // careful Promise.race handling.
  return postJson<StoredVideoAnalysis>('/api/videos/analyses', payload, {
    signal: options.signal,
    timeoutMs: options.timeoutMs,
    baseUrl: options.baseUrl,
    fetchImpl: options.fetchImpl,
    // The backend requires a signed-in user for this endpoint: it writes into
    // the shared events feed, and leaving it open made it the one path into
    // that table that asked for nothing.
    headers: options.headers ?? authHeaders(),
  })
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
