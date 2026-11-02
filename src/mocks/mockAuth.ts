import type { AuthUser } from '../types/auth'

/**
 * A demo account. Narrower than AuthUser on purpose: these do have a username
 * and a farm identifier, because they were invented for the demo. A real
 * session from the backend has neither, which is why AuthUser leaves both
 * optional and this type puts them back.
 */
export interface DemoAccount extends AuthUser {
  username: string
  farmId: string
}

export const demoAccounts: readonly DemoAccount[] = [
  { id: 'user-owner', username: 'carmen.rojas', name: 'Carmen Rojas', email: 'dueno@sanjose.demo', role: 'owner', farmId: 'farm-san-jose' },
  { id: 'user-worker', username: 'julian.perez', name: 'Julián Pérez', email: 'trabajador@sanjose.demo', role: 'worker', farmId: 'farm-san-jose' },
]

export const demoPassword = 'demo1234'
