import { aiServiceUrl, normalizeOptionalUrl } from '../api/config'
import { ApiError } from '../api/errors'
import { getJson } from '../api/httpClient'
import { parseCamerasResponse, parseLiveStatus } from '../api/validate'
import type { ApiLiveStatus } from '../types/api'
import type { ServiceOptions } from './options'

export interface LiveSource { baseUrl: string; status: ApiLiveStatus }

const isNetworkFailure = (error: unknown, options: ServiceOptions) => !options.signal?.aborted && error instanceof ApiError

/**
 * Where this camera's AI service can be reached: the public URL it reported to the backend (a tunnel),
 * else VITE_AI_SERVICE_URL. An explicit `aiServiceUrl` option skips the lookup.
 */
async function liveBaseUrl(cameraId: string, options: ServiceOptions): Promise<string> {
  if (options.aiServiceUrl !== undefined) return options.aiServiceUrl
  try {
    const cameras = parseCamerasResponse(await getJson<unknown>('/api/cameras', options))
    const reported = normalizeOptionalUrl(cameras.items.find(camera => camera.id === cameraId)?.stream_url)
    if (reported) return reported
  } catch (error) {
    if (!isNetworkFailure(error, options)) throw error
  }
  return aiServiceUrl
}

/**
 * Latest state of the AI service (live.py) streaming this camera, or null when it is not configured or not running.
 * The service runs on the farm PC next to the camera, so being unreachable is normal, not an error.
 */
export async function getLiveSource(cameraId: string, options: ServiceOptions = {}): Promise<LiveSource | null> {
  const baseUrl = await liveBaseUrl(cameraId, options)
  if (!baseUrl) return null
  try {
    const status = parseLiveStatus(await getJson<unknown>('/status', { ...options, baseUrl, timeoutMs: 6000 }))
    return status.camera_id === cameraId ? { baseUrl, status } : null
  } catch (error) {
    if (!isNetworkFailure(error, options)) throw error
    return null
  }
}
