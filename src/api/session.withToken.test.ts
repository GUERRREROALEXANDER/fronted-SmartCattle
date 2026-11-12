import { afterEach, describe, expect, it, vi } from 'vitest'
import { tokenStore, withSessionToken } from './session'

afterEach(() => vi.restoreAllMocks())

describe('withSessionToken', () => {
  it('adds the session to a picture from a public service', () => {
    vi.spyOn(tokenStore, 'get').mockReturnValue('a b')
    expect(withSessionToken('https://live.example/video.mjpg')).toBe('https://live.example/video.mjpg?token=a%20b')
    expect(withSessionToken('https://live.example/snapshot.jpg?t=3')).toBe('https://live.example/snapshot.jpg?t=3&token=a%20b')
  })
  it('never sends it in clear to a service on the local network', () => {
    vi.spyOn(tokenStore, 'get').mockReturnValue('secret')
    expect(withSessionToken('http://192.168.1.20:8090/video.mjpg')).toBe('http://192.168.1.20:8090/video.mjpg')
  })
  it('changes nothing without a session', () => {
    vi.spyOn(tokenStore, 'get').mockReturnValue(null)
    expect(withSessionToken('https://live.example/video.mjpg')).toBe('https://live.example/video.mjpg')
  })
})
