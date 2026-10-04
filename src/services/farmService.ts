import { mockFarm } from '../mocks/mockData'
import { mockFarmPlan, mockSecurityHours, type FarmPlan } from '../mocks/mockFarmPlan'
import type { Farm, Sourced } from '../types/domain'
import { resolveMockOnly, type ServiceOptions } from './options'

export type { FarmPlan, PlanCamera, PlanLot, PlanPoint } from '../mocks/mockFarmPlan'

export interface SecurityHours { restrictedFrom: number; restrictedTo: number }

export function getCurrentFarm(options: ServiceOptions = {}): Promise<Sourced<Farm | null>> {
  return resolveMockOnly(options, () => ({ ...mockFarm }))
}

/** Schematic farm plan. The backend has no farm geometry yet. */
export function getFarmPlan(options: ServiceOptions = {}): Promise<Sourced<FarmPlan | null>> {
  return resolveMockOnly(options, () => mockFarmPlan)
}

/** Restricted hours for security rules. The backend has no such rule yet. */
export function getSecurityHours(options: ServiceOptions = {}): Promise<Sourced<SecurityHours | null>> {
  return resolveMockOnly(options, () => ({ ...mockSecurityHours }))
}
