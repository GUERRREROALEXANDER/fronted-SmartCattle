import { dataMode } from '../api/config'
import { getJson } from '../api/httpClient'
import { parseEventsResponse } from '../api/validate'
import { buildMockFarmEvents } from '../mocks/mockData'
import type { FarmEvent, Sourced } from '../types/domain'
import { resolveSource } from './dataSource'
import { toFarmEvent } from './mappers'
import { waitForMock, type ServiceOptions } from './options'

export async function listEvents(options: ServiceOptions = {}): Promise<Sourced<FarmEvent[]>> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') {
    await waitForMock(options)
    return { data: buildMockFarmEvents(options.now), source }
  }
  const response = parseEventsResponse(await getJson<unknown>('/api/events', options))
  return { data: response.items.map(toFarmEvent), source }
}
