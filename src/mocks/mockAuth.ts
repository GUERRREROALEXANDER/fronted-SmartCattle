import type { AuthUser } from '../types/auth'

export const demoAccounts: readonly AuthUser[] = [
  { id: 'user-owner', name: 'Carmen Rojas', email: 'dueno@sanjose.demo', role: 'owner', farmId: 'farm-san-jose' },
  { id: 'user-worker', name: 'Julián Pérez', email: 'trabajador@sanjose.demo', role: 'worker', farmId: 'farm-san-jose' },
]

export const demoPassword = 'demo1234'
