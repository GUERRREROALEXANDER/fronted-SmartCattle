import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/errors'
import {
  configureManagedCamera, listManagedCameras, managedNameProblem, managedStateView, managerProblem, removeManagedCamera, rtspUrlProblem,
} from './cameraManagerService'

const reported = {
  id: 'cam-1', name: 'Corral', state: 'transmitiendo', address: '192.168.1.50:554', retries: 2,
  hls_url: 'http://127.0.0.1:8888/cam-1/index.m3u8',
}
const answer = (body: unknown, status = 200) => vi.fn<typeof fetch>().mockResolvedValue(Response.json(body, { status }))
const session = { token: 'la-sesion' }

describe('cameras through the backend', () => {
  it('lists with the session and sends no key of its own', async () => {
    const fetchImpl = answer({ items: [reported], total: 1 })
    const { data } = await listManagedCameras({ ...session, fetchImpl })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(String(url)).toMatch(/\/api\/camera-streams$/)
    const headers = new Headers(init?.headers)
    expect(headers.get('Authorization')).toBe('Bearer la-sesion')
    expect(headers.has('X-API-Key')).toBe(false)
    expect(data).toEqual([{ id: 'cam-1', name: 'Corral', state: 'transmitiendo', address: '192.168.1.50:554', retries: 2, hlsUrl: reported.hls_url }])
  })

  it('sends the name and the URL', async () => {
    const fetchImpl = answer(reported, 201)
    await configureManagedCamera(' Corral ', ' rtsp://a:b@10.0.0.2/x ', { fetchImpl })
    expect(JSON.parse(String(fetchImpl.mock.calls[0][1]?.body))).toEqual({ name: 'Corral', url: 'rtsp://a:b@10.0.0.2/x' })
  })

  it('removes by its id', async () => {
    const fetchImpl = vi.fn<typeof fetch>().mockResolvedValue(new Response(null, { status: 204 }))
    await removeManagedCamera('cam-1', { fetchImpl })
    expect(String(fetchImpl.mock.calls[0][0])).toMatch(/\/api\/camera-streams\/cam-1$/)
    expect(fetchImpl.mock.calls[0][1]?.method).toBe('DELETE')
  })

  it('does not trust what it cannot read', async () => {
    const { data } = await listManagedCameras({ fetchImpl: answer({ items: [{ ...reported, state: 'volando', hls_url: 'javascript:alert(1)' }] }) })
    expect(data[0]).toMatchObject({ state: 'detenido', hlsUrl: null })
    await expect(listManagedCameras({ fetchImpl: answer({ items: [{ state: 'conectando' }] }) })).rejects.toBeInstanceOf(ApiError)
  })
})

describe('the form', () => {
  it('needs a name', () => {
    expect(managedNameProblem('Corral')).toBeNull()
    expect(managedNameProblem('  ')).toMatch(/Escribe/)
  })

  it('takes only RTSP', () => {
    for (const url of ['rtsp://192.168.1.5:554/live', 'RTSP://u:c@cam.local/x', 'rtsps://10.0.0.1/a']) expect(rtspUrlProblem(url)).toBeNull()
    expect(rtspUrlProblem('')).toMatch(/Escribe/)
    for (const url of ['http://192.168.1.5', '192.168.1.5', 'file:///c:/x']) expect(rtspUrlProblem(url)).toMatch(/rtsp/)
    expect(rtspUrlProblem('rtsp://')).toMatch(/Falta/)
    expect(rtspUrlProblem('rtsp://a b/c')).toMatch(/espacios/)
  })
})

describe('what the person sees', () => {
  it('has words for each state, and points at the camera after several retries', () => {
    expect(managedStateView({ state: 'transmitiendo', retries: 0 }).tone).toBe('safe')
    expect(managedStateView({ state: 'sin_configurar', retries: 0 }).label).toBe('Sin configurar')
    expect(managedStateView({ state: 'reconectando', retries: 1 }).text).toMatch(/por sí solo/)
    expect(managedStateView({ state: 'reconectando', retries: 3 }).text).toMatch(/3 intentos/)
  })

  it('never repeats what the server said, and never asks the person for a key', () => {
    const detail = 'rtsp://admin:clave@192.168.1.5 fallo'
    for (const status of [403, 404, 409, 422, 429, 500, 502, 503]) {
      const message = managerProblem(new ApiError('http', 'x', { status, detail }))
      expect(message).not.toContain('clave@')
      expect(message).not.toMatch(/CAMERA_API_KEY|\.env/)
    }
  })

  it('tells a service that is off from a connection that is down', () => {
    expect(managerProblem(new ApiError('http', 'x', { status: 503 }))).toMatch(/servicio de cámaras/)
    expect(managerProblem(new ApiError('network', 'x'))).toMatch(/conexión/)
  })
})
