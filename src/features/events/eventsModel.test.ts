import { describe, expect, it } from 'vitest'
import { buildMockFarmEvents } from '../../mocks/mockData'
import { countByCategory, defaultFilters, filterEvents, groupByDay, hasActiveFilters, isRestrictedTime } from './eventsModel'

const now = new Date('2026-10-04T15:00:00')
const events = buildMockFarmEvents(now)

describe('eventsModel', () => {
  it('filters by category tab, period, camera and minimum severity', () => {
    expect(filterEvents(events, defaultFilters, now)).toHaveLength(events.length)
    const security = filterEvents(events, { ...defaultFilters, tab: 'security' }, now)
    expect(security.map(event => event.kind).sort()).toEqual(['person_detected', 'possible_intrusion', 'possible_unauthorized_movement'])
    expect(filterEvents(events, { ...defaultFilters, period: '24h' }, now).every(event => now.getTime() - event.occurredAt.getTime() <= 86_400_000)).toBe(true)
    expect(filterEvents(events, { ...defaultFilters, cameraId: 'corral' }, now).every(event => event.cameraId === 'corral')).toBe(true)
    expect(filterEvents(events, { ...defaultFilters, severity: 'critical' }, now).every(event => event.severity === 'critical')).toBe(true)
    expect(filterEvents(events, { ...defaultFilters, severity: 'warning' }, now).some(event => event.severity === 'info')).toBe(false)
  })

  it('counts events per category', () => {
    const counts = countByCategory(events)
    expect(counts.all).toBe(events.length)
    expect(counts.cattle + counts.security + counts.system).toBe(events.length)
    expect(counts.security).toBe(3)
  })

  it('groups by local day with Hoy and Ayer labels, keeping order', () => {
    const groups = groupByDay(events, now)
    expect(groups[0].label).toBe('Hoy')
    expect(groups[1].label).toBe('Ayer')
    expect(groups.flatMap(group => group.events)).toEqual(events)
  })

  it('detects restricted hours that wrap past midnight', () => {
    expect(isRestrictedTime(new Date('2026-10-04T02:14:00'), 19, 5)).toBe(true)
    expect(isRestrictedTime(new Date('2026-10-04T19:00:00'), 19, 5)).toBe(true)
    expect(isRestrictedTime(new Date('2026-10-04T05:00:00'), 19, 5)).toBe(false)
    expect(isRestrictedTime(new Date('2026-10-04T14:00:00'), 19, 5)).toBe(false)
    expect(isRestrictedTime(new Date('2026-10-04T10:00:00'), 8, 12)).toBe(true)
  })

  it('reports whether secondary filters are active', () => {
    expect(hasActiveFilters(defaultFilters)).toBe(false)
    expect(hasActiveFilters({ ...defaultFilters, tab: 'security' })).toBe(false)
    expect(hasActiveFilters({ ...defaultFilters, severity: 'critical' })).toBe(true)
  })
})
