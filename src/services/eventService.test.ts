import { describe, expect, it, vi } from 'vitest'
import { listEventPage, listEvents } from './eventService'

const event = (over: Record<string, unknown> = {}) => ({
  id: 'e1', event_type: 'cattle_out_of_zone', camera_id: 'camera-01',
  detected_object: 'cow', confidence: 0.95,
  timestamp: '2026-10-29T10:00:00Z', received_at: '2026-10-29T10:00:01Z',
  level: 'high', ...over,
})

const replying = (body: unknown) => vi.fn<typeof fetch>().mockResolvedValue(Response.json(body))
const sentUrl = (fetchImpl: ReturnType<typeof replying>) => String(fetchImpl.mock.calls[0][0])

describe('listEvents', () => {
  it('sorts by detection time, not arrival', async () => {
    // The backend orders by arrival, because that is the clock it controls. A
    // late-arriving event must not jump ahead of one detected after it.
    const fetchImpl = replying({
      items: [
        event({ id: 'late', timestamp: '2026-10-29T09:00:00Z', received_at: '2026-10-29T11:00:00Z' }),
        event({ id: 'early', timestamp: '2026-10-29T10:00:00Z', received_at: '2026-10-29T10:00:01Z' }),
      ],
      total: 2,
    })
    const result = await listEvents({ mode: 'api', fetchImpl })
    expect(result.data.map(item => item.id)).toEqual(['early', 'late'])
  })

  it('reads the severity the backend assigned', async () => {
    const fetchImpl = replying({ items: [event({ level: 'high' })], total: 1 })
    const result = await listEvents({ mode: 'api', fetchImpl })
    expect(result.data[0]).toMatchObject({ severity: 'critical', severitySource: 'backend' })
  })
})

describe('listEventPage', () => {
  it('reports the match count, not the page length', async () => {
    // A caller paging on items.length cannot tell whether there is more, and
    // stops one page early.
    const fetchImpl = replying({ items: [event()], total: 137 })
    const result = await listEventPage({ limit: 1 }, { mode: 'api', fetchImpl })
    expect(result.data.total).toBe(137)
    expect(result.data.events).toHaveLength(1)
  })

  it('translates a severity into the backend vocabulary', async () => {
    const fetchImpl = replying({ items: [], total: 0 })
    await listEventPage({ severity: 'critical' }, { mode: 'api', fetchImpl })
    expect(sentUrl(fetchImpl)).toContain('level=high')
  })

  it('sends every filter it is given', async () => {
    const fetchImpl = replying({ items: [], total: 0 })
    await listEventPage(
      { cameraId: 'camera-02', kind: 'cattle_out_of_zone', limit: 20, offset: 40 },
      { mode: 'api', fetchImpl },
    )
    const url = sentUrl(fetchImpl)
    expect(url).toContain('camera_id=camera-02')
    expect(url).toContain('event_type=cattle_out_of_zone')
    expect(url).toContain('limit=20')
    expect(url).toContain('offset=40')
  })

  it('sends no query when there are no filters', async () => {
    const fetchImpl = replying({ items: [], total: 0 })
    await listEventPage({}, { mode: 'api', fetchImpl })
    expect(sentUrl(fetchImpl)).toMatch(/\/api\/events$/)
  })

  it('omits a zero offset, which is the default anyway', async () => {
    const fetchImpl = replying({ items: [], total: 0 })
    await listEventPage({ offset: 0 }, { mode: 'api', fetchImpl })
    expect(sentUrl(fetchImpl)).not.toContain('offset')
  })

  it('filters locally in mock mode rather than ignoring the controls', async () => {
    // A demo where the filters visibly do nothing teaches the user the
    // controls are broken, which is worse than not offering them.
    const fetchImpl = vi.fn<typeof fetch>()
    const now = new Date('2026-10-29T12:00:00Z')
    const all = await listEventPage({}, { mode: 'mock', now, fetchImpl })
    const oneCamera = all.data.events[0]?.cameraId

    const filtered = await listEventPage({ cameraId: oneCamera }, { mode: 'mock', now, fetchImpl })
    expect(filtered.data.events.every(item => item.cameraId === oneCamera)).toBe(true)
    expect(filtered.data.total).toBeLessThanOrEqual(all.data.total)
    expect(fetchImpl).not.toHaveBeenCalled()
  })

  it('counts the matches before slicing in mock mode', async () => {
    const now = new Date('2026-10-29T12:00:00Z')
    const all = await listEventPage({}, { mode: 'mock', now })
    const firstPage = await listEventPage({ limit: 1 }, { mode: 'mock', now })
    // total must describe the match set, so the two agree even though only one
    // row came back.
    expect(firstPage.data.events).toHaveLength(1)
    expect(firstPage.data.total).toBe(all.data.total)
  })

  it('pages without overlap in mock mode', async () => {
    const now = new Date('2026-10-29T12:00:00Z')
    const first = await listEventPage({ limit: 2, offset: 0 }, { mode: 'mock', now })
    const second = await listEventPage({ limit: 2, offset: 2 }, { mode: 'mock', now })
    const ids = new Set(first.data.events.map(item => item.id))
    expect(second.data.events.some(item => ids.has(item.id))).toBe(false)
  })
})
