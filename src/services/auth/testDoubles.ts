import { vi } from 'vitest'
import type { SafeStorage } from '../../lib/safeStorage'

export const NOW = new Date('2026-10-29T12:00:00Z')

export const apiUser = {
  id: 7,
  email: 'ana@finca.example',
  full_name: 'Ana Restrepo',
  role: 'owner',
  is_active: true,
  created_at: '2026-10-01T08:00:00Z',
  last_login_at: null,
}

export const tokenResponse = {
  access_token: 'a-signed-token',
  token_type: 'bearer',
  expires_in: 3600,
  user: apiUser,
}

/** A storage double that records what was written, with no browser involved. */
export function memoryStorage(initial: Record<string, unknown> = {}): SafeStorage & {
  readonly entries: Map<string, unknown>
} {
  const entries = new Map<string, unknown>(Object.entries(initial))
  return {
    entries,
    getJson: <T>(key: string) => (entries.has(key) ? entries.get(key) as T : null),
    setJson: (key, value) => { entries.set(key, value) },
    remove: key => { entries.delete(key) },
  }
}

/** Replies to each call in order, so a sequence of requests can be scripted. */
export function scriptedFetch(...responses: Response[]) {
  const queue = [...responses]
  return vi.fn<typeof fetch>().mockImplementation(async () => {
    const next = queue.shift()
    if (!next) throw new Error('scriptedFetch ran out of responses')
    return next
  })
}
