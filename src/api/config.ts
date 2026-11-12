export type DataMode = 'api' | 'mock' | 'hybrid'

export function parseDataMode(value: unknown): DataMode {
  return value === 'api' || value === 'hybrid' || value === 'mock' ? value : 'mock'
}

export function normalizeBaseUrl(value: unknown): string {
  const url = typeof value === 'string' ? value.trim().replace(/\/+$/, '') : ''
  return url || 'http://localhost:8000'
}

/** Local AI service (live.py) that serves the camera video. Empty means no live video. */
export function normalizeOptionalUrl(value: unknown): string {
  return typeof value === 'string' ? value.trim().replace(/\/+$/, '') : ''
}

const localNames = new Set(['localhost', '127.0.0.1', '[::1]'])

/**
 * On another device, "localhost" would be that device: a service configured that way is on the PC serving this page.
 */
export function reachableFromPage(url: string, pageHost = globalThis.location?.hostname ?? ''): string {
  if (!url || !pageHost || localNames.has(pageHost)) return url
  try {
    const parsed = new URL(url)
    if (!localNames.has(parsed.hostname)) return url
    parsed.hostname = pageHost
    return parsed.toString().replace(/\/+$/, '')
  } catch {
    return url
  }
}

export const apiBaseUrl = reachableFromPage(normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL))
export const aiServiceUrl = reachableFromPage(normalizeOptionalUrl(import.meta.env.VITE_AI_SERVICE_URL))
export const dataMode = parseDataMode(import.meta.env.VITE_DATA_SOURCE)
