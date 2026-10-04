export type DataMode = 'api' | 'mock' | 'hybrid'

export function parseDataMode(value: unknown): DataMode {
  return value === 'api' || value === 'hybrid' || value === 'mock' ? value : 'mock'
}

export function normalizeBaseUrl(value: unknown): string {
  const url = typeof value === 'string' ? value.trim().replace(/\/+$/, '') : ''
  return url || 'http://localhost:8000'
}

export const apiBaseUrl = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL)
export const dataMode = parseDataMode(import.meta.env.VITE_DATA_SOURCE)
