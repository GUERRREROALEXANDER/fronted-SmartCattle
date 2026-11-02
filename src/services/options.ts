import { dataMode, type DataMode } from '../api/config'
import { authHeaders } from '../api/session'
import type { Sourced } from '../types/domain'
import { mockDelay, resolveSource } from './dataSource'

export interface ServiceOptions {
  mode?: DataMode
  signal?: AbortSignal
  fetchImpl?: typeof fetch
  now?: Date
  /** Overrides VITE_AI_SERVICE_URL; an empty string disables live video. */
  aiServiceUrl?: string
  /**
   * Overrides the Authorization header the service would read from the stored
   * session. Injected rather than reached for, so a service can be tested
   * without a browser storage and so a caller holding a token directly -- a
   * sign-up flow that has one before it is persisted -- can use it.
   */
  headers?: Record<string, string>
}

/** The caller's headers if given, otherwise the current session's. */
export function requestHeaders(options: ServiceOptions): Record<string, string> {
  return options.headers ?? authHeaders()
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
