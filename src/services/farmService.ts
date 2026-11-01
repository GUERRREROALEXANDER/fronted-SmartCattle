import { dataMode } from '../api/config'
import { ApiError } from '../api/errors'
import { getJson } from '../api/httpClient'
import { parseFarmsResponse, parseLotsResponse, parseUser } from '../api/parsers'
import { parseCamerasResponse } from '../api/validate'
import { demoAccounts } from '../mocks/mockAuth'
import { mockCameras, mockFarm, mockLots, mockSecurityHours } from '../mocks/mockData'
import type { ApiUser } from '../types/api'
import type { Farm, Lot, Sourced, UserRole } from '../types/domain'
import { resolveSource } from './dataSource'
import { buildFarmPlan, type FarmPlan } from './farmLayout'
import { toLot } from './mappers'
import { resolveMockOnly, waitForMock, type ServiceOptions } from './options'

export type { FarmPlan, PlanCamera, PlanLot, PlanPoint } from './farmLayout'

export interface SecurityHours { restrictedFrom: number; restrictedTo: number }

/** The signed-in person's farm: the first one the backend lists. Null until a farm is registered. */
export async function getCurrentFarm(options: ServiceOptions = {}): Promise<Sourced<Farm | null>> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') {
    await waitForMock(options)
    return { data: { ...mockFarm }, source }
  }
  const [farm] = parseFarmsResponse(await getJson<unknown>('/api/farms', options)).items
  return { data: farm ? { id: String(farm.id), name: farm.name, location: farm.location, areaHectares: farm.area_hectares } : null, source }
}

/** Lots of the current farm (GET /api/farms/{id}/lots). Empty when no farm is registered. */
export async function listLots(options: ServiceOptions = {}): Promise<Sourced<Lot[]>> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') {
    await waitForMock(options)
    return { data: mockLots.map(lot => ({ ...lot })), source }
  }
  const farm = await getCurrentFarm(options)
  if (!farm.data) return { data: [], source }
  const response = parseLotsResponse(await getJson<unknown>(`/api/farms/${encodeURIComponent(farm.data.id)}/lots`, options))
  return { data: response.items.map(toLot), source }
}

/**
 * The farm drawing for the plan and the 3D pasture, built from the real lots and every camera the AI
 * service has reported (online or not). Null when the farm has neither lots nor cameras yet.
 */
export async function getFarmPlan(options: ServiceOptions = {}): Promise<Sourced<FarmPlan | null>> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') {
    await waitForMock(options)
    return { data: buildFarmPlan(mockLots, mockCameras), source }
  }
  const [lots, cameras] = await Promise.all([
    listLots(options),
    getJson<unknown>('/api/cameras', options).then(parseCamerasResponse),
  ])
  return { data: buildFarmPlan(lots.data, cameras.items), source }
}

export interface FarmMember { id: string; name: string; email: string; role: UserRole; active: boolean }

/** Accounts of the farm (GET /api/users). Only owners may list them; for workers it is unavailable. */
export async function listFarmMembers(options: ServiceOptions = {}): Promise<Sourced<FarmMember[] | null>> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') {
    await waitForMock(options)
    return { data: demoAccounts.map(({ id, name, email, role }) => ({ id, name, email, role, active: true })), source }
  }
  try {
    const body = await getJson<unknown>('/api/users', { ...options, query: { limit: 200 } })
    const items = body && typeof body === 'object' && Array.isArray((body as { items?: unknown }).items)
      ? ((body as { items: unknown[] }).items).map(parseUser)
      : []
    return { data: items.map((user: ApiUser) => ({ id: String(user.id), name: user.full_name, email: user.email, role: user.role, active: user.is_active })), source }
  } catch (error) {
    if (error instanceof ApiError && error.status === 403) return { data: null, source: 'unavailable' }
    throw error
  }
}

/** Restricted hours for security rules. The backend has no such rule yet, so only the demo shows them. */
export function getSecurityHours(options: ServiceOptions = {}): Promise<Sourced<SecurityHours | null>> {
  return resolveMockOnly(options, () => ({ ...mockSecurityHours }))
}
