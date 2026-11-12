import { describe, expect, it } from 'vitest'
import { normalizeBaseUrl, parseDataMode } from './config'

describe('parseDataMode', () => {
  it.each(['api', 'mock', 'hybrid'] as const)('accepts %s', mode => expect(parseDataMode(mode)).toBe(mode))
  it.each([undefined, null, '', 'API', 'invalid', 1, {}])('defaults invalid input %s to mock', value => {
    expect(parseDataMode(value)).toBe('mock')
  })
})

describe('normalizeBaseUrl', () => {
  it.each([undefined, null, '', '  ', '///', 42])('defaults empty or invalid input %s', value => {
    expect(normalizeBaseUrl(value)).toBe('http://localhost:8000')
  })
  it('removes trailing slashes and whitespace while retaining path prefixes', () => {
    expect(normalizeBaseUrl(' http://localhost:8000/prefix/// ')).toBe('http://localhost:8000/prefix')
  })
})

describe('reachableFromPage', () => {
  it('swaps localhost for the address the page was opened on', async () => {
    const { reachableFromPage } = await import('./config')
    expect(reachableFromPage('http://localhost:8000', '192.168.1.10')).toBe('http://192.168.1.10:8000')
    expect(reachableFromPage('http://127.0.0.1:8090', '192.168.1.10')).toBe('http://192.168.1.10:8090')
  })
  it('leaves other addresses, and pages opened on this PC, alone', async () => {
    const { reachableFromPage } = await import('./config')
    expect(reachableFromPage('http://localhost:8000', 'localhost')).toBe('http://localhost:8000')
    expect(reachableFromPage('https://api.example.com', '192.168.1.10')).toBe('https://api.example.com')
    expect(reachableFromPage('', '192.168.1.10')).toBe('')
    expect(reachableFromPage('not a url', '192.168.1.10')).toBe('not a url')
  })
})
