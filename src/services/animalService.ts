import { dataMode } from '../api/config'
import { getJson } from '../api/httpClient'
import { parseAnimalsResponse } from '../api/validate'
import { mockDetectedCattle, mockRegisteredCattle } from '../mocks/mockData'
import type { Sourced } from '../types/domain'
import { resolveSource } from './dataSource'
import { resolveMockOnly, waitForMock, type ServiceOptions } from './options'

export async function getRegisteredCattleCount(options: ServiceOptions = {}): Promise<Sourced<number>> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') {
    await waitForMock(options)
    return { data: mockRegisteredCattle, source }
  }
  const response = parseAnimalsResponse(await getJson<unknown>('/api/animals', options))
  return { data: response.total, source }
}

/** Farm-wide count from the vision service, with the time it was taken. Not the sum of what camera images show. */
export interface HerdCount { count: number; countedAt: Date }

export function getDetectedCattleCount(options: ServiceOptions = {}): Promise<Sourced<HerdCount | null>> {
  return resolveMockOnly(options, now => ({ count: mockDetectedCattle, countedAt: new Date(now) }))
}
