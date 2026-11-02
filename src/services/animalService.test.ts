import { describe, expect, it, vi } from 'vitest'
import {
  deactivateAnimal,
  getRegisteredCattleCount,
  listAnimals,
  registerAnimal,
  tagExists,
  toAnimal,
  updateAnimal,
} from './animalService'

const apiAnimal = {
  tag: 'A-441',
  name: 'Lucera',
  status: 'active' as const,
  camera_id: 'camera-01',
  last_detection: '2026-10-29T12:00:00Z',
  created_at: '2026-10-01T08:00:00Z',
  updated_at: '2026-10-29T12:00:00Z',
}

const replying = (body: unknown) =>
  vi.fn<typeof fetch>().mockResolvedValue(Response.json(body))

const sentBody = (fetchImpl: ReturnType<typeof replying>) =>
  JSON.parse((fetchImpl.mock.calls[0][1] as RequestInit).body as string)

const sentUrl = (fetchImpl: ReturnType<typeof replying>) =>
  String(fetchImpl.mock.calls[0][0])

describe('toAnimal', () => {
  it('parses the timestamps into dates', () => {
    const animal = toAnimal(apiAnimal)
    expect(animal.lastDetection).toEqual(new Date('2026-10-29T12:00:00Z'))
    expect(animal.createdAt).toEqual(new Date('2026-10-01T08:00:00Z'))
  })

  it('keeps a never detected animal as null, not epoch', () => {
    // new Date(null) is 1970, which would sort as the staleest animal on the
    // farm and read as a real sighting.
    expect(toAnimal({ ...apiAnimal, last_detection: null }).lastDetection).toBeNull()
  })

  it('keeps an unlocated animal as null', () => {
    expect(toAnimal({ ...apiAnimal, camera_id: null }).cameraId).toBeNull()
  })
})

describe('listAnimals', () => {
  it('maps the herd from the backend', async () => {
    const fetchImpl = replying({ items: [apiAnimal], total: 1 })
    const result = await listAnimals({ mode: 'api', fetchImpl })

    expect(result.source).toBe('api')
    expect(result.data).toHaveLength(1)
    expect(result.data[0].tag).toBe('A-441')
  })

  it('asks for every status by default', async () => {
    const fetchImpl = replying({ items: [], total: 0 })
    await listAnimals({ mode: 'api', fetchImpl })
    // Unfiltered, matching the backend: animals are deactivated rather than
    // deleted, so a default filter would hide rows the total still counts.
    expect(sentUrl(fetchImpl)).toMatch(/\/api\/animals$/)
  })

  it('passes a status filter through', async () => {
    const fetchImpl = replying({ items: [], total: 0 })
    await listAnimals({ mode: 'api', fetchImpl, status: 'lost' })
    expect(sentUrl(fetchImpl)).toContain('status=lost')
  })

  it('returns the demo herd in mock mode without a request', async () => {
    const fetchImpl = vi.fn<typeof fetch>()
    const result = await listAnimals({ mode: 'mock', now: new Date('2026-10-29T12:00:00Z'), fetchImpl })

    expect(result.source).toBe('mock')
    expect(result.data.length).toBeGreaterThan(0)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('includes an unlocated animal in the demo herd', async () => {
    // The row a badly written filter drops, and the first one a farmer wants.
    const result = await listAnimals({ mode: 'mock', now: new Date('2026-10-29T12:00:00Z') })
    expect(result.data.some(animal => animal.cameraId === null && animal.lastDetection === null)).toBe(true)
  })
})

describe('getRegisteredCattleCount', () => {
  it('reads the total the backend reports', async () => {
    // The regression that mattered: this endpoint used to be a stub returning
    // zero, so the dashboard showed an empty farm.
    const fetchImpl = replying({ items: [apiAnimal], total: 42 })
    await expect(getRegisteredCattleCount({ mode: 'api', fetchImpl }))
      .resolves.toMatchObject({ data: 42, source: 'api' })
  })
})

describe('writing', () => {
  // Injected rather than written into a browser storage the node test
  // environment does not have -- and it keeps each test's authorisation
  // visible at the call site.
  const signedIn = { headers: { Authorization: 'Bearer a-token' } }

  it('registers an animal and sends the token', async () => {
    const fetchImpl = replying(apiAnimal)
    await registerAnimal({ tag: ' A-441 ', name: ' Lucera ', cameraId: 'camera-01' }, { fetchImpl, ...signedIn })

    const init = fetchImpl.mock.calls[0][1] as RequestInit
    expect(init.method).toBe('POST')
    // The backend requires the owner role, so the header has to be there or
    // the write is a 401.
    expect(new Headers(init.headers).get('authorization')).toBe('Bearer a-token')
    expect(sentBody(fetchImpl)).toEqual({ tag: 'A-441', name: 'Lucera', camera_id: 'camera-01' })
  })

  it('sends null rather than an empty name', async () => {
    const fetchImpl = replying(apiAnimal)
    await registerAnimal({ tag: 'A-441', name: '   ' }, { fetchImpl, ...signedIn })
    // An empty string is how a form says "not set"; storing it would leave two
    // ways to express the same absence.
    expect(sentBody(fetchImpl)).toMatchObject({ name: null, camera_id: null })
  })

  it('sends only the fields an update mentions', async () => {
    const fetchImpl = replying(apiAnimal)
    await updateAnimal('A-441', { status: 'lost' }, { fetchImpl, ...signedIn })

    // The classic partial-update bug: including the untouched keys as
    // undefined would blank the animal's name and camera.
    expect(sentBody(fetchImpl)).toEqual({ status: 'lost' })
    expect((fetchImpl.mock.calls[0][1] as RequestInit).method).toBe('PATCH')
  })

  it('can clear a name explicitly', async () => {
    const fetchImpl = replying(apiAnimal)
    await updateAnimal('A-441', { name: null }, { fetchImpl, ...signedIn })
    // Sending null and omitting the key have to mean different things.
    expect(sentBody(fetchImpl)).toEqual({ name: null })
  })

  it('escapes a tag in the path', async () => {
    const fetchImpl = replying(apiAnimal)
    await updateAnimal('A 441', { status: 'lost' }, { fetchImpl, ...signedIn })
    // A raw space would produce an invalid URL; the backend rejects the tag
    // anyway, but the request has to be well formed to get that answer.
    expect(sentUrl(fetchImpl)).toContain('A%20441')
  })

  it('deactivates rather than deleting', async () => {
    const fetchImpl = replying({ ...apiAnimal, status: 'inactive' })
    const animal = await deactivateAnimal('A-441', { fetchImpl, ...signedIn })

    expect((fetchImpl.mock.calls[0][1] as RequestInit).method).toBe('POST')
    expect(sentUrl(fetchImpl)).toContain('/deactivate')
    expect(animal.status).toBe('inactive')
  })

  it('checks whether a tag is taken', async () => {
    await expect(tagExists('A-441', { fetchImpl: replying({ exists: true }), ...signedIn })).resolves.toBe(true)
    await expect(tagExists('A-999', { fetchImpl: replying({ exists: false }), ...signedIn })).resolves.toBe(false)
  })

  it('treats a malformed exists answer as not taken', async () => {
    // A truthy non-boolean must not read as taken: the form would refuse a tag
    // that is free, and the user has no way to tell why.
    await expect(tagExists('A-441', { fetchImpl: replying({ exists: 'yes' }), ...signedIn })).resolves.toBe(false)
  })
})
