import { dataMode } from '../api/config'
import { getJson } from '../api/httpClient'
import { parseAnimalsResponse } from '../api/validate'
import { mockDetectedCattle, mockRegisteredCattle } from '../mocks/mockData'
import type { Sourced } from '../types/domain'
import { resolveSource } from './dataSource'
import { getLiveMetrics } from './metricsService'
import { waitForMock, type ServiceOptions } from './options'

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

/** The AI's current head count across every camera (cattle_total of GET /api/metrics/live). */
export async function getDetectedCattleCount(options: ServiceOptions = {}): Promise<Sourced<HerdCount | null>> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') {
    await waitForMock(options)
    return { data: { count: mockDetectedCattle, countedAt: new Date(options.now ?? new Date()) }, source }
  }
  const metrics = await getLiveMetrics(options)
  // Without a single camera report the AI has not counted anything yet: that is not "zero cows".
  if (metrics.data.camerasTotal === 0) return { data: null, source }
  return { data: { count: metrics.data.cattleTotal, countedAt: metrics.data.generatedAt }, source }
}
