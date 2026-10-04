import { dataMode, type DataMode } from '../api/config'
import type { Sourced } from '../types/domain'
import { mockDelay, resolveSource } from './dataSource'

export interface ServiceOptions {
  mode?: DataMode
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  now?: Date
}

export async function waitForMock(options: ServiceOptions): Promise<void> {
  options.signal?.throwIfAborted()
  if (options.now === undefined) await mockDelay()
  options.signal?.throwIfAborted()
}

export async function resolveMockOnly<T>(options: ServiceOptions, build: (now: Date) => T): Promise<Sourced<T | null>> {
  const source = resolveSource('mock-only', options.mode ?? dataMode)
  await waitForMock(options)
  if (source === 'unavailable') return { data: null, source }
  return { data: build(options.now ?? new Date()), source }
}
