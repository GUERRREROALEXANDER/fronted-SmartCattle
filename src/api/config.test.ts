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
