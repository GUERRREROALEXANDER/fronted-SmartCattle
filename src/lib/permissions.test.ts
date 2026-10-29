import { expect, it } from 'vitest'
import { can, type Permission } from './permissions'

const matrix: [Permission, boolean][] = [
  ['farm:edit', false], ['workers:manage', false], ['cameras:configure', false],
  ['alerts:configure', false], ['security-hours:configure', false],
  // The two the backend enforces on its own write endpoints. These have to
  // agree with it, or the interface offers controls that return 403.
  ['herd:edit', false], ['zones:edit', false],
  ['monitoring:view', true], ['events:view', true], ['events:review', true],
]
it.each(matrix)('checks owner and worker permissions for %s', (permission, workerAllowed) => {
  expect(can('owner', permission)).toBe(true)
  expect(can('worker', permission)).toBe(workerAllowed)
})

it('allows the owner everything in the list', () => {
  // Stated as a property, so adding a permission is allowed for the owner by
  // default and only the worker side needs a decision.
  expect(matrix.every(([permission]) => can('owner', permission))).toBe(true)
})

it('lets a worker watch the farm but not define it', () => {
  // The split the backend applies: registering an animal decides what the
  // herd is, and configuring a zone decides what counts as an escape.
  expect(can('worker', 'monitoring:view')).toBe(true)
  expect(can('worker', 'events:review')).toBe(true)
  expect(can('worker', 'herd:edit')).toBe(false)
  expect(can('worker', 'zones:edit')).toBe(false)
})
