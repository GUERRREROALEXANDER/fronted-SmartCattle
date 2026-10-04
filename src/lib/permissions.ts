import type { UserRole } from '../types/domain'

export type Permission = 'farm:edit' | 'workers:manage' | 'cameras:configure' | 'alerts:configure'
  | 'security-hours:configure' | 'monitoring:view' | 'events:view' | 'events:review'

const workerPermissions: readonly Permission[] = ['monitoring:view', 'events:view', 'events:review']

// UI gating only; the backend must enforce permissions.
export function can(role: UserRole, permission: Permission): boolean {
  return role === 'owner' || (role === 'worker' && workerPermissions.includes(permission))
}
