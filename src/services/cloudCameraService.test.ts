import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/errors'
import { connectCamera, connectProblem, isLanAddress, listCameraSuggestions, listCloudCameras } from './cloudCameraService'

const reply = (body: unknown) => vi.fn(async () => new Response(JSON.stringify(body), { status: 200, headers: { 'Content-Type': 'application/json' } }))

describe('isLanAddress', () => {
  it('knows the addresses that only exist inside a home or farm network', () => {
    for (const address of ['192.168.100.30', '10.0.0.4', '172.20.1.1', 'rtsp://192.168.1.5:554/live', 'camara.local', 'camara']) {
      expect(isLanAddress(address)).toBe(true)
    }
    for (const address of ['181.50.3.2', '8.8.8.8', 'micamara.ddns.net', '172.32.0.1']) {
      expect(isLanAddress(address)).toBe(false)
    }
  })
})

describe('connectCamera', () => {
  it('sends only what was typed and reads the recommendation', async () => {
    const fetchImpl = reply({
      outcome: 'choose', message: 'x', camera: null, recommended: '04797CEPSF59DA6',
      suggestions: [{ serial: '04797CEPSF59DA6', name: 'Corral', model: null, online: true, camera_id: null }, { name: 'no serial' }],
    })
    const result = await connectCamera({ address: ' 192.168.100.30 ', serial: '' }, { fetchImpl, headers: {} })
    const sent = JSON.parse(String((fetchImpl.mock.calls[0] as unknown as [string, RequestInit])[1].body))
    expect(sent).toEqual({ address: '192.168.100.30' })
    expect(result.outcome).toBe('choose')
    expect(result.recommended).toBe('04797CEPSF59DA6')
    expect(result.suggestions).toEqual([{ serial: '04797CEPSF59DA6', name: 'Corral', model: null, online: true, cameraId: null }])
  })

  it('reads the connected camera with its address', async () => {
    const fetchImpl = reply({ outcome: 'connected', message: 'ok', suggestions: [],
      camera: { id: 'cam-1', name: 'Corral', source: 'imou:X', status: 'offline', address: '192.168.100.30', cloud: true } })
    const result = await connectCamera({ serial: '04797CEPSF59DA6' }, { fetchImpl, headers: {} })
    expect(result.camera).toEqual({ id: 'cam-1', name: 'Corral', address: '192.168.100.30', status: 'offline', cloud: true })
  })
})

describe('lists', () => {
  it('keeps only the cloud cameras of the account', async () => {
    const fetchImpl = reply({ items: [
      { id: 'cam-1', name: 'Corral', status: 'online', address: '192.168.100.30', cloud: true },
      { id: 'cam-2', name: 'Celular', status: 'online', cloud: false },
    ] })
    const listed = await listCloudCameras({ fetchImpl, headers: {}, mode: 'api' })
    expect(listed.data.map(camera => camera.id)).toEqual(['cam-1'])
  })

  it('shows no suggestions in demo mode and never calls the server', async () => {
    const fetchImpl = vi.fn()
    expect((await listCameraSuggestions({ fetchImpl, mode: 'mock' })).data).toEqual({ available: false, items: [] })
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('connectProblem', () => {
  it('explains each failure in plain words', () => {
    expect(connectProblem(new ApiError('http', 'x', { status: 503 }))).toMatch(/cuenta Imou/)
    expect(connectProblem(new ApiError('http', 'x', { status: 409, detail: 'This camera is already connected to another account' }))).toMatch(/otra cuenta/)
    expect(connectProblem(new ApiError('network', 'x'))).toMatch(/internet/)
    expect(connectProblem(new Error('boom'))).toMatch(/otra vez/)
  })
})
