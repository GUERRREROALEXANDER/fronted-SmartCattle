import type { AuthUser } from '../types/auth'

export const demoAccounts: readonly AuthUser[] = [
  { id: 'user-owner', username: 'carmen.rojas', name: 'Carmen Rojas', email: 'dueno@sanjose.demo', role: 'owner', farmId: 'farm-san-jose' },
  { id: 'user-worker', username: 'julian.perez', name: 'Julián Pérez', email: 'trabajador@sanjose.demo', role: 'worker', farmId: 'farm-san-jose' },
]

export const demoPassword = 'demo1234'
