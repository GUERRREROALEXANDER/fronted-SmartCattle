import { expect, it } from 'vitest'
import { can, type Permission } from './permissions'

const matrix: [Permission, boolean][] = [
  ['farm:edit', false], ['workers:manage', false], ['cameras:configure', false],
  ['alerts:configure', false], ['security-hours:configure', false],
  ['monitoring:view', true], ['events:view', true], ['events:review', true],
]
it.each(matrix)('checks owner and worker permissions for %s', (permission, workerAllowed) => {
  expect(can('owner', permission)).toBe(true)
  expect(can('worker', permission)).toBe(workerAllowed)
})
