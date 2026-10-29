import type { UserRole } from '../types/domain'

export type Permission = 'farm:edit' | 'workers:manage' | 'cameras:configure' | 'alerts:configure'
  | 'security-hours:configure' | 'monitoring:view' | 'events:view' | 'events:review'
  // The two the backend enforces on its write endpoints.
  | 'herd:edit' | 'zones:edit'

/**
 * What a worker may do. Everything else is owner only.
 *
 * A worker watches the farm and reviews its alerts; an owner also defines it.
 * That is the same split the backend applies: registering an animal decides
 * what the herd is, and configuring a zone decides what counts as an escape.
 */
const workerPermissions: readonly Permission[] = ['monitoring:view', 'events:view', 'events:review']

/**
 * Interface gating only -- the backend must enforce permissions.
 *
 * Keeping this list in step with the backend is what stops the interface
 * offering a control whose every use returns 403. It is not a security
 * boundary: anything reachable from the browser is reachable without it.
 */
export function can(role: UserRole, permission: Permission): boolean {
  return role === 'owner' || (role === 'worker' && workerPermissions.includes(permission))
}
