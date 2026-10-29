import { describe, expect, it } from 'vitest'
import {
  axisTick,
  categoryColors,
  categoryFills,
  chartAnimation,
  chartColors,
  confidenceColors,
  gridLine,
  severityColors,
} from './chartTheme'

const palettes = { categoryColors, categoryFills, severityColors, confidenceColors }

describe('the chart palette', () => {
  it('reads every colour from a CSS variable', () => {
    // Not a literal. The whole palette has to follow the theme, and a
    // hard-coded hex is invisible in light mode or unreadable in dark.
    for (const value of Object.values(chartColors)) {
      expect(value).toMatch(/^var\(--[a-z-]+\)$/)
    }
  })

  it.each(Object.entries(palettes))('builds %s out of the shared palette', (_name, palette) => {
    // Every series colour has to come from chartColors rather than being
    // introduced locally, or the charts drift apart from each other.
    const known = new Set(Object.values(chartColors))
    for (const value of Object.values(palette)) {
      expect(known.has(value)).toBe(true)
    }
  })

  it('gives each event category its own stroke', () => {
    // Two categories sharing a colour makes a stacked chart unreadable, and
    // the legend a lie.
    const strokes = Object.values(categoryColors)
    expect(new Set(strokes).size).toBe(strokes.length)
  })

  it('gives each severity its own colour', () => {
    const colours = Object.values(severityColors)
    expect(new Set(colours).size).toBe(colours.length)
  })

  it('keeps the category fill distinct from its stroke', () => {
    // The fill is the pastel companion of the stroke. If they matched, the
    // area would swallow its own outline.
    for (const category of Object.keys(categoryColors) as (keyof typeof categoryColors)[]) {
      expect(categoryFills[category]).not.toBe(categoryColors[category])
    }
  })

  it('separates the unknown confidence bucket from the real ones', () => {
    // "Unknown" is an absence of data, not a low value, and colouring it like
    // one invites reading it as a measurement.
    const real = Object.entries(confidenceColors)
      .filter(([bucket]) => bucket !== 'unknown')
      .map(([, colour]) => colour)
    expect(real).not.toContain(confidenceColors.unknown)
  })

  it('covers every confidence bucket', () => {
    expect(Object.keys(confidenceColors).sort()).toEqual(
      ['50to70', '70to85', '85to100', 'under50', 'unknown'],
    )
  })
})

describe('the chart chrome', () => {
  it('keeps the axis labels legible rather than tiny', () => {
    expect(axisTick.fontSize).toBeGreaterThanOrEqual(11)
  })

  it('draws horizontal grid lines only', () => {
    // Vertical lines on a time axis add ink without adding information, and
    // the charts share this so they look like one system.
    expect(gridLine.vertical).toBe(false)
  })

  it('keeps the animation inside the documented 600-900 ms band', () => {
    // The comment states the band. Longer feels broken on a dashboard that
    // refreshes every fifteen seconds.
    expect(chartAnimation.animationDuration).toBeGreaterThanOrEqual(600)
    expect(chartAnimation.animationDuration).toBeLessThanOrEqual(900)
  })

  it('starts the animation immediately', () => {
    expect(chartAnimation.animationBegin).toBe(0)
  })
})
