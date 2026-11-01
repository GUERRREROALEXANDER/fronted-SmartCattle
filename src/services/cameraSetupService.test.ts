import { afterEach, describe, expect, it, vi } from 'vitest'
import { tokenStore } from '../api/session'
import { addCamera, getCameraServiceState, isAddedCamera, removeCamera, serviceRoot } from './cameraSetupService'

const answer = { status: 'connecting', camera_id: 'cam-192-168-1-50-554-a1b2', stream_url: 'http://localhost:8090/cameras/cam-192-168-1-50-554-a1b2' }

afterEach(() => tokenStore.clear())

describe('camera setup service', () => {
  it('finds the service behind a camera, added or not', () => {
    expect(serviceRoot('http://localhost:8090')).toBe('http://localhost:8090')
    expect(serviceRoot(answer.stream_url)).toBe('http://localhost:8090')
    expect(serviceRoot('https://abc.trycloudflare.com/cameras/x')).toBe('https://abc.trycloudflare.com')
    expect(isAddedCamera(answer.stream_url)).toBe(true)
    expect(isAddedCamera('http://localhost:8090')).toBe(false)
    expect(isAddedCamera(null)).toBe(false)
  })
  it('adds a camera with only what the person typed', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json(answer, { status: 202 }))
    await expect(addCamera('http://localhost:8090', { kind: 'ip', host: ' 192.168.1.50 ', username: '', password: 'clave', path: ' ' }, { fetchImpl }))
      .resolves.toEqual({ cameraId: answer.camera_id, streamUrl: answer.stream_url })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(url).toBe('http://localhost:8090/cameras')
    expect(init?.method).toBe('POST')
    expect(JSON.parse(String(init?.body))).toEqual({ host: '192.168.1.50', password: 'clave' })
  })
  it('sends a custom RTSP path', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json(answer, { status: 202 }))
    await addCamera('http://localhost:8090', { kind: 'ip', host: '10.0.0.5', username: 'admin', password: 'x', path: '/Streaming/Channels/102' }, { fetchImpl })
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({ host: '10.0.0.5', username: 'admin', password: 'x', path: '/Streaming/Channels/102' })
  })
  it('proves the session when changing cameras, and only then', async () => {
    tokenStore.set('jwt-123', 3600)
    const fetchImpl = vi.fn<typeof fetch>().mockImplementation(async () => Response.json({ ...answer, camera_id: answer.camera_id }, { status: 202 }))
    await addCamera('http://localhost:8090', { kind: 'url', url: '1' }, { fetchImpl })
    await removeCamera('http://localhost:8090', 'cam-webcam-1', { fetchImpl })
    await getCameraServiceState('http://localhost:8090', { fetchImpl })
    const authorization = fetchImpl.mock.calls.map(([, init]) => (init?.headers as Record<string, string> | undefined)?.Authorization)
    expect(authorization).toEqual(['Bearer jwt-123', 'Bearer jwt-123', undefined])
    expect(fetchImpl.mock.calls[1][0]).toBe('http://localhost:8090/cameras/cam-webcam-1')
    expect(fetchImpl.mock.calls[1][1]?.method).toBe('DELETE')
  })
  it('rejects an answer without the new camera', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(Response.json({ status: 'connecting' }, { status: 202 }))
    await expect(addCamera('http://localhost:8090', { kind: 'url', url: '1' }, { fetchImpl })).rejects.toThrow()
  })
})
