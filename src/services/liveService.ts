import { aiServiceUrl } from '../api/config'
import { ApiError } from '../api/errors'
import { getJson } from '../api/httpClient'
import { parseLiveStatus } from '../api/validate'
import type { ApiLiveStatus } from '../types/api'
import type { ServiceOptions } from './options'

const liveBaseUrl = (options: ServiceOptions) => options.aiServiceUrl ?? aiServiceUrl

export const liveVideoUrl = (options: ServiceOptions = {}) => `${liveBaseUrl(options)}/video.mjpg`

/**
 * Latest state of the local AI service (live.py), or null when it is not configured or not running.
 * The service runs on the farm PC next to the camera, so being unreachable is normal, not an error.
 */
export async function getLiveStatus(options: ServiceOptions = {}): Promise<ApiLiveStatus | null> {
  const baseUrl = liveBaseUrl(options)
  if (!baseUrl) return null
  try {
    return parseLiveStatus(await getJson<unknown>('/status', { ...options, baseUrl, timeoutMs: 4000 }))
  } catch (error) {
    if (options.signal?.aborted || !(error instanceof ApiError)) throw error
    return null
  }
}
