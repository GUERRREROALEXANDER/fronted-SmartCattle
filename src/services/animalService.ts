import { dataMode } from '../api/config'
import { getJson } from '../api/httpClient'
import { mockDetectedCattle, mockRegisteredCattle } from '../mocks/mockData'
import type { ApiAnimalsResponse } from '../types/api'
import type { Sourced } from '../types/domain'
import { resolveSource } from './dataSource'
import { resolveMockOnly, waitForMock, type ServiceOptions } from './options'

export async function getRegisteredCattleCount(options: ServiceOptions = {}): Promise<Sourced<number>> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') {
    await waitForMock(options)
    return { data: mockRegisteredCattle, source }
  }
  const response = await getJson<ApiAnimalsResponse>('/api/animals', options)
  return { data: response.total, source }
}

export function getDetectedCattleCount(options: ServiceOptions = {}): Promise<Sourced<number | null>> {
  return resolveMockOnly(options, () => mockDetectedCattle)
}
