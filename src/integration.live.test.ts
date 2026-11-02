/**
 * Runs the frontend's own services against a live backend.
 *
 * Every other test in this suite stubs `fetch`, which proves the frontend
 * handles the shapes it *expects*. This one proves those shapes are the ones
 * the backend actually sends -- a mismatch that no amount of stubbed testing
 * can catch, because the stub and the parser are written from the same
 * assumption.
 *
 * Skipped unless a backend is reachable, so it never fails CI or a checkout
 * without one. To run it:
 *
 *   # backend, from its own repository
 *   $env:DATABASE_URL = "sqlite:///./smoke.db"
 *   $env:JWT_SECRET = "a-secret-at-least-32-bytes-long-0123"
 *   alembic upgrade head
 *   uvicorn app.main:app --port 8000
 *
 *   # here
 *   $env:SMARTCATTLE_LIVE_API = "http://127.0.0.1:8000"
 *   npm test -- src/integration.live.test.ts
 */
import { describe, expect, it } from 'vitest'
import { getJson } from './api/httpClient'
import { parseCamerasResponse, parseEventsResponse, parseStatusResponse, isHealthy } from './api/validate'
import { listAnimals, registerAnimal, deactivateAnimal } from './services/animalService'
import { createSafeZone, deleteSafeZone, listSafeZones } from './services/zoneService'
import { getSystemStatus } from './services/statusService'
import { listEventPage } from './services/eventService'
import { createApiAuthService } from './services/auth/apiAuthService'
import type { SafeStorage } from './lib/safeStorage'

// Declared rather than pulled in from @types/node: this file sits in the app
// tsconfig, which deliberately types only what runs in a browser.
declare const process: { env: Record<string, string | undefined> } | undefined
const baseUrl = (typeof process === 'undefined' ? undefined : process.env.SMARTCATTLE_LIVE_API) ?? ''

/** Storage double: this runs in Node, where there is no localStorage. */
function memoryStorage(): SafeStorage {
  const entries = new Map<string, unknown>()
  return {
    getJson: <T>(key: string) => (entries.has(key) ? entries.get(key) as T : null),
    setJson: (key, value) => { entries.set(key, value) },
    remove: key => { entries.delete(key) },
  }
}

/**
 * Probed at module scope, not in beforeAll.
 *
 * Whether a suite is skipped is decided while the file is collected, which
 * happens before any hook runs -- so a flag set in beforeAll arrives too late
 * and every case skips even with a backend running.
 */
const reachable = await (async () => {
  if (!baseUrl) return false
  try {
    return isHealthy(await getJson<unknown>('/health', { baseUrl, timeoutMs: 4000 }))
  } catch {
    return false
  }
})()

if (!baseUrl) {
  console.info('integration.live: set SMARTCATTLE_LIVE_API to run these against a backend')
} else if (!reachable) {
  console.warn(`integration.live: no backend answered at ${baseUrl}; skipping`)
}

const live = () => (reachable ? describe : describe.skip)

/** A fresh address per run, so a rerun does not collide on the unique email. */
const email = `integration-${Date.now()}@finca.example`
const password = 'una-clave-larga-de-prueba'

/**
 * Registered at module scope, for the same reason as the probe above.
 *
 * The backend makes the first account the owner and every later one a worker,
 * so which role this run gets depends on whether the database is fresh. Both
 * are worth exercising, and `it` versus `it.skip` is decided while the file is
 * collected -- so the role has to be known by then.
 */
const account = await (async () => {
  if (!reachable) return null
  try {
    const session = await createApiAuthService({ storage: memoryStorage(), baseUrl })
      .register({ email, password })
    return {
      role: session.user.role,
      headers: { Authorization: `Bearer ${session.accessToken}` },
    }
  } catch (error) {
    console.warn('integration.live: could not register an account', error)
    return null
  }
})()

const headers: Record<string, string> = account?.headers ?? {}
const role = account?.role ?? null
const asOwner = () => (role === 'owner' ? it : it.skip)
const asWorker = () => (role === 'worker' ? it : it.skip)

live()('the frontend against a live backend', () => {
  const tag = `IT-${Date.now()}`

  it('reads the health endpoint', async () => {
    expect(isHealthy(await getJson<unknown>('/health', { baseUrl }))).toBe(true)
  })

  it('parses the status the backend really sends', async () => {
    // parseStatusResponse throws on an unexpected shape, so reaching the
    // assertions means the contract held.
    const status = parseStatusResponse(await getJson<unknown>('/api/status', { baseUrl }))
    expect(status.status).toBe('ok')
    expect(status.version).toMatch(/^\d+\.\d+\.\d+$/)
  })

  it('reports the storage the backend is using', async () => {
    const { data } = await getSystemStatus({ mode: 'api', baseUrl } as never)
    expect(data.backend).toBe('online')
    // The point of this assertion: 'memory' means the backend is running
    // without a database, so nothing it accepts will survive a restart.
    expect(data.storage).not.toBe('memory')
  })

  it('registered an account and got a usable token', () => {
    // Registered at module scope; this asserts it worked.
    expect(account).not.toBeNull()
    expect(headers.Authorization).toMatch(/^Bearer .+/)
    expect(role === 'owner' || role === 'worker').toBe(true)
  })

  it('signs the same account in again', async () => {
    const session = await createApiAuthService({ storage: memoryStorage(), baseUrl })
      .login({ identifier: email, password })
    expect(session.source).toBe('api')
    expect(session.accessToken).toBeTruthy()
    expect(session.user.email).toBe(email)
  })

  it('confirms a stored token against the backend', async () => {
    // getSession() re-reads the account rather than trusting the token, which
    // is what makes a deactivated account stop working immediately.
    const storage = memoryStorage()
    const auth = createApiAuthService({ storage, baseUrl })
    await auth.login({ identifier: email, password })
    const restored = await auth.getSession()
    expect(restored?.user.email).toBe(email)
  })

  it('refuses a wrong password', async () => {
    const auth = createApiAuthService({ storage: memoryStorage(), baseUrl })
    await expect(auth.login({ identifier: email, password: 'incorrecta' }))
      .rejects.toMatchObject({ code: 'invalid_credentials' })
  })

  asOwner()('writes an animal and reads it back', async () => {
    // The whole chain: this parser, that HTTP client, the backend's route, its
    // store and the database. Reading the tag back is the proof it persisted.
    const created = await registerAnimal({ tag, name: 'Integración' }, { baseUrl, headers } as never)
    expect(created.tag).toBe(tag)

    const herd = await listAnimals({ mode: 'api', baseUrl, headers } as never)
    expect(herd.source).toBe('api')
    expect(herd.data.some(animal => animal.tag === tag)).toBe(true)
  })

  asOwner()('deactivates rather than deleting', async () => {
    const animal = await deactivateAnimal(tag, { baseUrl, headers } as never)
    expect(animal.status).toBe('inactive')

    const herd = await listAnimals({ mode: 'api', baseUrl, headers } as never)
    // Still there: there is no delete on either side.
    expect(herd.data.some(item => item.tag === tag)).toBe(true)
  })

  asOwner()('writes a safe zone and reads its geometry back', async () => {
    const outline = [[0.2, 0.2], [0.8, 0.3], [0.5, 0.7]] as const
    const zone = await createSafeZone(`camera-it-${Date.now()}`, {
      name: 'Zona de integración',
      bounds: [0.1, 0.1, 0.9, 0.9],
      outline: [...outline],
    }, { baseUrl, headers } as never)

    expect(zone.bounds).toEqual([0.1, 0.1, 0.9, 0.9])
    // The polygon survives the round trip through the backend's JSON column,
    // which is where a column mapped as text would quietly corrupt it.
    expect(zone.outline).toEqual([...outline])

    const zones = await listSafeZones(undefined, { mode: 'api', baseUrl, headers } as never)
    expect(zones.data?.some(item => item.id === zone.id)).toBe(true)

    await deleteSafeZone(zone.id, { baseUrl, headers } as never)
  })

  asOwner()('rejects geometry the frontend would also reject', async () => {
    // Both sides refuse an inverted rectangle. It would make the whole frame
    // read as outside the zone, firing one alert per visible animal.
    await expect(createSafeZone('camera-it-bad', {
      name: 'Invertida', bounds: [0.9, 0.9, 0.1, 0.1],
    }, { baseUrl, headers } as never)).rejects.toBeTruthy()
  })

  it('parses the event feed and its filters', async () => {
    const page = await listEventPage({ limit: 5 }, { mode: 'api', baseUrl, headers } as never)
    expect(page.source).toBe('api')
    expect(typeof page.data.total).toBe('number')

    // The filters have to be understood by the backend, not just appended.
    const high = await listEventPage({ severity: 'critical', limit: 5 }, {
      mode: 'api', baseUrl, headers,
    } as never)
    expect(high.data.events.every(event => event.severity === 'critical')).toBe(true)
  })

  it('parses the camera list', async () => {
    const cameras = parseCamerasResponse(await getJson<unknown>('/api/cameras', { baseUrl }))
    expect(Array.isArray(cameras.items)).toBe(true)
  })

  it('parses the raw event response shape', async () => {
    // parseEventsResponse is what every event screen depends on. Running it
    // against the real payload is the contract check.
    const events = parseEventsResponse(await getJson<unknown>('/api/events', { baseUrl }))
    expect(typeof events.total).toBe('number')
    for (const event of events.items) {
      expect(['low', 'medium', 'high']).toContain(event.level)
    }
  })

  it('refuses a write without a token', async () => {
    await expect(registerAnimal({ tag: `IT-anon-${Date.now()}` }, {
      baseUrl, headers: {},
    } as never)).rejects.toMatchObject({ status: 401 })
  })

  asWorker()('refuses a herd write to a worker', async () => {
    // 403 and not 401: the request was authenticated and the account simply
    // may not do this. The two call for different messages, and the interface
    // now gives them different ones.
    await expect(registerAnimal({ tag: `IT-worker-${Date.now()}` }, {
      baseUrl, headers,
    } as never)).rejects.toMatchObject({ status: 403 })
  })

  asWorker()('refuses a zone write to a worker', async () => {
    await expect(createSafeZone('camera-it-worker', {
      name: 'Zona', bounds: [0.1, 0.1, 0.9, 0.9],
    }, { baseUrl, headers } as never)).rejects.toMatchObject({ status: 403 })
  })

  it('lets any signed-in account read the herd', async () => {
    // Reads are open to both roles: a worker watches the farm.
    const herd = await listAnimals({ mode: 'api', baseUrl, headers } as never)
    expect(herd.source).toBe('api')
    expect(Array.isArray(herd.data)).toBe(true)
  })
})
