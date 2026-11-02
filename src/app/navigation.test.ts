import { describe, expect, it } from 'vitest'
import { navItems, profileItem } from './navigation'

describe('navItems', () => {
  it('has a unique id per item', () => {
    // router.tsx looks pages up by id and the mobile tab bar keys on it, so a
    // duplicate silently renders the same page twice.
    const ids = navItems.map(item => item.id)
    expect(new Set(ids).size).toBe(ids.length)
  })

  it('has a unique path per item', () => {
    const paths = navItems.map(item => item.path)
    expect(new Set(paths).size).toBe(paths.length)
  })

  it('starts every path with a slash', () => {
    // A relative path would resolve against whatever route is current, so the
    // same link would go somewhere different depending on where it was used.
    expect(navItems.every(item => item.path.startsWith('/'))).toBe(true)
  })

  it('has exactly one root path', () => {
    expect(navItems.filter(item => item.path === '/')).toHaveLength(1)
  })

  it('gives every item a label and an icon', () => {
    // The mobile tab bar shows the icon alone, so a missing one leaves a tab
    // that cannot be identified.
    for (const item of navItems) {
      expect(item.label.length).toBeGreaterThan(0)
      expect(item.icon).toBeTruthy()
    }
  })

  it('keeps the mobile tab bar to four items', () => {
    // The tab bar lays out a fixed four; a fifth either overflows or shrinks
    // the others past a usable touch target.
    expect(navItems.filter(item => item.primaryOnMobile)).toHaveLength(4)
  })

  it('puts the dashboard among the mobile primaries', () => {
    const primary = navItems.filter(item => item.primaryOnMobile).map(item => item.id)
    expect(primary).toContain('dashboard')
  })

  it('does not put the profile in the main navigation', () => {
    // It is reached from the top bar, and listing it twice would make the
    // active-link highlight ambiguous.
    expect(navItems.map(item => item.id)).not.toContain('profile')
  })
})

describe('profileItem', () => {
  it('has its own path, distinct from every nav item', () => {
    expect(profileItem.path).toBe('/profile')
    expect(navItems.map(item => item.path)).not.toContain(profileItem.path)
  })

  it('has a label and an icon', () => {
    expect(profileItem.label.length).toBeGreaterThan(0)
    expect(profileItem.icon).toBeTruthy()
  })
})
