import { dataMode } from '../api/config'
import { ApiError } from '../api/errors'
import { getJson } from '../api/httpClient'
import { buildMockSystemStatus } from '../mocks/mockData'
import type { ApiHealth, ApiStatus } from '../types/api'
import type { Sourced, SystemStatus } from '../types/domain'
import { resolveSource } from './dataSource'
import { waitForMock, type ServiceOptions } from './options'

export async function getSystemStatus(options: ServiceOptions = {}): Promise<Sourced<SystemStatus>> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') {
    await waitForMock(options)
    return { data: buildMockSystemStatus(options.now), source }
  }
  const checkedAt = new Date(options.now ?? new Date())
  try {
    await getJson<ApiHealth>('/health', options)
  } catch (error) {
    if (options.signal?.aborted) throw error
    if (!(error instanceof ApiError) || !['network', 'timeout', 'http'].includes(error.kind)) throw error
    return { data: { backend: 'offline', aiConfigured: null, version: null, storage: null, checkedAt }, source }
  }
  const status = await getJson<ApiStatus>('/api/status', options)
  return { data: { backend: 'online', aiConfigured: status.ai_service.configured, version: status.version, storage: status.storage, checkedAt }, source }
}
