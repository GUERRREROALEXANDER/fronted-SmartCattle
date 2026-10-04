import { mockFarm } from '../mocks/mockData'
import type { Farm, Sourced } from '../types/domain'
import { resolveMockOnly, type ServiceOptions } from './options'

export function getCurrentFarm(options: ServiceOptions = {}): Promise<Sourced<Farm | null>> {
  return resolveMockOnly(options, () => ({ ...mockFarm }))
}
