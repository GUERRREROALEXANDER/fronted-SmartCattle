import type { DataMode } from '../api/config'
import type { DataSource } from '../types/domain'

export function resolveSource(capability: 'backend' | 'mock-only', mode: DataMode): DataSource {
  if (mode === 'mock') return 'mock'
  if (capability === 'backend') return 'api'
  return mode === 'hybrid' ? 'mock' : 'unavailable'
}

export function mockDelay(ms = 250): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, ms))
}
