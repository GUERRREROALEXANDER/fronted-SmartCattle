import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { AnimatedNumber, DeltaChip, PulseRing, staggerDelay, STAGGER_MAX_ITEMS } from '.'

describe('DeltaChip', () => {
  it('marks an increase as good when up is good', () => {
    const html = renderToStaticMarkup(<DeltaChip value={3} goodWhen="up" />)
    expect(html).toContain('▲')
    expect(html).toContain('aria-label="Aumento: 3"')
  })

  it('uses the absolute value for decreases', () => {
    const html = renderToStaticMarkup(<DeltaChip value={-2.5} />)
    expect(html).toContain('▼')
    expect(html).toContain('Disminución: 2,5')
  })

  it('reports no change for zero', () => {
    expect(renderToStaticMarkup(<DeltaChip value={0} />)).toContain('aria-label="Sin cambios"')
  })

  it('applies a different tone class when the direction flips meaning', () => {
    const upGood = renderToStaticMarkup(<DeltaChip value={1} goodWhen="up" />)
    const upBad = renderToStaticMarkup(<DeltaChip value={1} goodWhen="down" />)
    expect(upGood).not.toBe(upBad)
  })
})

describe('PulseRing', () => {
  it('renders the pulse only while active', () => {
    const active = renderToStaticMarkup(<PulseRing><button>x</button></PulseRing>)
    const idle = renderToStaticMarkup(<PulseRing active={false}><button>x</button></PulseRing>)
    expect(active).toContain('aria-hidden="true"')
    expect(idle).not.toContain('aria-hidden="true"')
  })
})

describe('AnimatedNumber', () => {
  it('renders the formatted starting value', () => {
    expect(renderToStaticMarkup(<AnimatedNumber value={1234} />)).toContain('1.234')
    expect(renderToStaticMarkup(<AnimatedNumber value={7} format={v => `${v} vacas`} />)).toContain('7 vacas')
  })
})

describe('staggerDelay', () => {
  it('caps the delay after the maximum number of items', () => {
    expect(staggerDelay(STAGGER_MAX_ITEMS + 5)).toBe(staggerDelay(STAGGER_MAX_ITEMS))
  })
})
