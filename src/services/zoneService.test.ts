import { describe, expect, it, vi } from 'vitest'
import {
  createSafeZone,
  deleteSafeZone,
  listSafeZones,
  toSafeZone,
  updateSafeZone,
} from './zoneService'

const apiZone = {
  id: 1,
  camera_id: 'camera-01',
  name: 'Safe zone',
  x_min: 0.1, y_min: 0.1, x_max: 0.9, y_max: 0.9,
  outline: null,
  active: true,
  created_at: '2026-10-01T08:00:00Z',
}

const signedIn = { headers: { Authorization: 'Bearer a-token' } }
const replying = (body: unknown, status = 200) =>
  vi.fn<typeof fetch>().mockResolvedValue(
    status === 204 ? new Response(null, { status }) : Response.json(body, { status }),
  )
const sentBody = (fetchImpl: ReturnType<typeof replying>) =>
  JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string)
const sentUrl = (fetchImpl: ReturnType<typeof replying>) => String(fetchImpl.mock.calls[0][0])
const sentInit = (fetchImpl: ReturnType<typeof replying>) => fetchImpl.mock.calls[0][1] as RequestInit

describe('toSafeZone', () => {
  it('gives the rectangle as bounds', () => {
    // The shape SafeZone already had, so the editor and the overlays did not
    // change when zones stopped being local state.
    expect(toSafeZone(apiZone).bounds).toEqual([0.1, 0.1, 0.9, 0.9])
  })

  it('omits the outline when there is none', () => {
    // Absent rather than an empty array: the overlays test for the property,
    // and an empty polygon would read as a zone enclosing nothing.
    expect(toSafeZone(apiZone).outline).toBeUndefined()
  })

  it('converts the polygon to tuples', () => {
    const zone = toSafeZone({
      ...apiZone,
      outline: [{ x: 0.2, y: 0.2 }, { x: 0.8, y: 0.3 }, { x: 0.5, y: 0.7 }],
    })
    expect(zone.outline).toEqual([[0.2, 0.2], [0.8, 0.3], [0.5, 0.7]])
  })
})

describe('listSafeZones', () => {
  it('reads the zones of a camera', async () => {
    const fetchImpl = replying({ items: [apiZone], total: 1 })
    const result = await listSafeZones('camera-01', { mode: 'api', fetchImpl, ...signedIn })

    expect(result.source).toBe('api')
    expect(result.data?.[0].cameraId).toBe('camera-01')
    expect(sentUrl(fetchImpl)).toContain('camera_id=camera-01')
  })

  it('sends the token, because zones are not public', async () => {
    const fetchImpl = replying({ items: [], total: 0 })
    await listSafeZones(undefined, { mode: 'api', fetchImpl, ...signedIn })
    // A zone describes where the farm's animals are meant to be, which is not
    // something to hand to an anonymous caller.
    expect(new Headers(sentInit(fetchImpl).headers).get('authorization')).toBe('Bearer a-token')
  })

  it('returns the demo zones without a request in mock mode', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const result = await listSafeZones('camera-01', {
      mode: 'mock', now: new Date('2026-10-29T12:00:00Z'), fetchImpl,
    })
    expect(result.source).toBe('mock')
    expect(fetchImpl).not.toHaveBeenCalled()
  })
})

describe('writing zones', () => {
  it('puts the camera in the path and the geometry in the body', async () => {
    const fetchImpl = replying(apiZone)
    await createSafeZone('camera-01', { name: ' Safe zone ', bounds: [0.1, 0.1, 0.9, 0.9] }, {
      fetchImpl, ...signedIn,
    })

    // The camera is in the path because a zone cannot be moved between
    // cameras: it cascades with the camera it belongs to.
    expect(sentUrl(fetchImpl)).toContain('/api/zones/camera/camera-01')
    expect(sentInit(fetchImpl).method).toBe('POST')
    expect(sentBody(fetchImpl)).toEqual({
      name: 'Safe zone', x_min: 0.1, y_min: 0.1, x_max: 0.9, y_max: 0.9, outline: null,
    })
  })

  it('sends a polygon as the backend stores it', async () => {
    const fetchImpl = replying(apiZone)
    await createSafeZone('camera-01', {
      name: 'Poly', bounds: [0.1, 0.1, 0.9, 0.9],
      outline: [[0.2, 0.2], [0.8, 0.3], [0.5, 0.7]],
    }, { fetchImpl, ...signedIn })

    expect(sentBody(fetchImpl).outline).toEqual([
      { x: 0.2, y: 0.2 }, { x: 0.8, y: 0.3 }, { x: 0.5, y: 0.7 },
    ])
  })

  it('sends null for an empty polygon rather than an empty array', async () => {
    // An empty array would be a zone enclosing nothing. Null means "rectangle
    // only", which is what an editor with no polygon drawn means.
    const fetchImpl = replying(apiZone)
    await createSafeZone('camera-01', { name: 'Rect', bounds: [0.1, 0.1, 0.9, 0.9], outline: [] }, {
      fetchImpl, ...signedIn,
    })
    expect(sentBody(fetchImpl).outline).toBeNull()
  })

  it('sends only what an update mentions', async () => {
    const fetchImpl = replying(apiZone)
    await updateSafeZone('1', { active: false }, { fetchImpl, ...signedIn })

    expect(sentInit(fetchImpl).method).toBe('PATCH')
    // Renaming must not touch the geometry, and here losing it means losing
    // the safe zone itself.
    expect(sentBody(fetchImpl)).toEqual({ active: false })
  })

  it('replaces the geometry as a whole', async () => {
    const fetchImpl = replying(apiZone)
    await updateSafeZone('1', { geometry: { name: 'Safe zone', bounds: [0.2, 0.2, 0.8, 0.8] } }, {
      fetchImpl, ...signedIn,
    })
    // A single corner cannot be validated against the others without knowing
    // them, which is why it travels together.
    expect(sentBody(fetchImpl).geometry).toMatchObject({ x_min: 0.2, x_max: 0.8 })
  })

  it('deletes a zone and accepts the empty response', async () => {
    // 204 has no body. A client that parsed it anyway would report a parse
    // error for a delete that worked.
    const fetchImpl = replying(null, 204)
    await expect(deleteSafeZone('1', { fetchImpl, ...signedIn })).resolves.toBeUndefined()
    expect(sentInit(fetchImpl).method).toBe('DELETE')
  })
})
