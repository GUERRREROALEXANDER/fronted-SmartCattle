import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import type { Animal } from '../../types/domain'
import { HerdPanel } from './HerdPanel'

const NOW = new Date('2026-10-29T12:00:00Z')
const hoursAgo = (hours: number) => new Date(NOW.getTime() - hours * 3_600_000)

const animal = (over: Partial<Animal> & { tag: string }): Animal => ({
  name: null, status: 'active', cameraId: null, lastDetection: hoursAgo(1),
  createdAt: hoursAgo(1000), updatedAt: hoursAgo(1), ...over,
})

const render = (animals: Animal[]) => renderToStaticMarkup(<HerdPanel animals={animals} now={NOW} />)

describe('HerdPanel', () => {
  it('explains what registering the herd buys, when there is none', () => {
    const html = render([])
    // An empty state that only says "no data" leaves the user without the one
    // thing they need to know: that counting what the camera sees is not the
    // same as knowing which animals are missing.
    expect(html).toContain('No hay animales registrados')
    expect(html).toContain('cuáles faltan')
  })

  it('shows the registered and active counts', () => {
    const html = render([animal({ tag: 'A-1' }), animal({ tag: 'A-2', status: 'inactive' })])
    expect(html).toContain('Registrados')
    expect(html).toContain('Activos')
  })

  it('hides the lost count when nothing is lost', () => {
    // A zero next to "Perdidos" is a row that draws the eye to nothing.
    expect(render([animal({ tag: 'A-1' })])).not.toContain('Perdidos')
  })

  it('shows the lost count when something is', () => {
    expect(render([animal({ tag: 'A-1', status: 'lost' })])).toContain('Perdidos')
  })

  it('says in words that an animal has never been detected', () => {
    const html = render([animal({ tag: 'A-1', lastDetection: null })])
    // Rather than a count beside "sin ver", which would not say whether the
    // animal was never seen or merely not seen lately.
    expect(html).toContain('nunca se ha detectado')
    expect(html).toContain('Nunca detectado')
  })

  it('distinguishes never detected from not seen lately', () => {
    const html = render([
      animal({ tag: 'A-1', lastDetection: null }),
      animal({ tag: 'A-2', lastDetection: hoursAgo(60) }),
    ])
    expect(html).toContain('nunca se ha detectado')
    expect(html).toContain('sin ver desde hace más de')
  })

  it('leads with the most concerning animal', () => {
    const html = render([
      animal({ tag: 'STALE', lastDetection: hoursAgo(60) }),
      animal({ tag: 'LOST', status: 'lost' }),
    ])
    // Ordered by concern, so the row a farmer must act on is the first one and
    // not somewhere down a list sorted by tag.
    expect(html.indexOf('LOST')).toBeLessThan(html.indexOf('STALE'))
  })

  it('says so plainly when every animal has been seen', () => {
    const html = render([animal({ tag: 'A-1' }), animal({ tag: 'A-2' })])
    expect(html).toContain('se han visto en las últimas')
    expect(html).not.toContain('<table')
  })

  it('uses a dash for a missing name, not an empty cell', () => {
    // A blank cell reads as data that failed to load; the name is optional.
    const html = render([animal({ tag: 'A-1', name: null, status: 'lost' })])
    expect(html).toContain('—')
  })

  it('keeps a name when there is one', () => {
    expect(render([animal({ tag: 'A-1', name: 'Lucera', status: 'lost' })])).toContain('Lucera')
  })

  it('describes the table for a screen reader', () => {
    const html = render([animal({ tag: 'A-1', status: 'lost' })])
    // The order is the information. Without the caption, a screen reader
    // announces four columns and no reason for the sequence.
    expect(html).toContain('del más preocupante al menos')
  })

  it('reports a gap of days rather than a large hour count', () => {
    const html = render([animal({ tag: 'A-1', lastDetection: hoursAgo(72) })])
    expect(html).toContain('días')
  })
})
