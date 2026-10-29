import { dataMode } from '../api/config'
import { getJson, patchJson, postJson } from '../api/httpClient'
import { parseAnimal, parseAnimalsResponse } from '../api/validate'
import { authHeaders } from '../api/session'
import { mockDetectedCattle, mockRegisteredCattle } from '../mocks/mockData'
import { buildMockHerd } from '../mocks/mockHerd'
import type { Animal, AnimalStatus, Sourced } from '../types/domain'
import type { ApiAnimal } from '../types/api'
import { resolveSource } from './dataSource'
import { resolveMockOnly, waitForMock, type ServiceOptions } from './options'

/** The backend speaks snake_case and ISO strings; the interface wants Dates. */
export function toAnimal(animal: ApiAnimal): Animal {
  return {
    tag: animal.tag,
    name: animal.name,
    status: animal.status,
    cameraId: animal.camera_id,
    lastDetection: animal.last_detection ? new Date(animal.last_detection) : null,
    createdAt: new Date(animal.created_at),
    updatedAt: new Date(animal.updated_at),
  }
}

export interface AnimalDraft {
  tag: string
  name?: string | null
  cameraId?: string | null
  status?: AnimalStatus
}

/** The registered herd. Unfiltered by default, matching the backend. */
export async function listAnimals(
  options: ServiceOptions & { status?: AnimalStatus } = {},
): Promise<Sourced<Animal[]>> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') {
    await waitForMock(options)
    return { data: buildMockHerd(options.now), source }
  }
  const query = options.status ? `?status=${options.status}` : ''
  const response = parseAnimalsResponse(await getJson<unknown>(`/api/animals${query}`, options))
  return { data: response.items.map(toAnimal), source }
}

/**
 * How many animals are registered.
 *
 * Reads the herd's length rather than a separate count, because there is no
 * count endpoint and `total` from the list is the same number. Until the
 * backend had an animals table this read a hardcoded zero, which is why the
 * dashboard reported an empty farm.
 */
export async function getRegisteredCattleCount(options: ServiceOptions = {}): Promise<Sourced<number>> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') {
    await waitForMock(options)
    return { data: mockRegisteredCattle, source }
  }
  const response = parseAnimalsResponse(await getJson<unknown>('/api/animals', options))
  return { data: response.total, source }
}

export async function registerAnimal(draft: AnimalDraft, options: ServiceOptions = {}): Promise<Animal> {
  // Owner only on the backend. The Authorization header comes from the stored
  // session; without one the backend answers 401 and the caller surfaces it.
  const body = await postJson<unknown>('/api/animals', {
    tag: draft.tag.trim(),
    name: draft.name?.trim() || null,
    camera_id: draft.cameraId || null,
    ...(draft.status ? { status: draft.status } : {}),
  }, { ...options, headers: authHeaders() })
  return toAnimal(parseAnimal(body))
}

export async function updateAnimal(
  tag: string,
  changes: Partial<Pick<AnimalDraft, 'name' | 'cameraId' | 'status'>>,
  options: ServiceOptions = {},
): Promise<Animal> {
  // Only the keys present are sent, so the backend's partial update keeps the
  // fields this call does not mention. Spreading undefined values instead
  // would blank them.
  const body: Record<string, unknown> = {}
  if ('name' in changes) body.name = changes.name?.trim() || null
  if ('cameraId' in changes) body.camera_id = changes.cameraId || null
  if ('status' in changes && changes.status) body.status = changes.status

  const response = await patchJson<unknown>(`/api/animals/${encodeURIComponent(tag)}`, body, {
    ...options, headers: authHeaders(),
  })
  return toAnimal(parseAnimal(response))
}

/**
 * Withdraws an animal from the active herd.
 *
 * There is no delete, and that is deliberate on both sides: a removed animal
 * leaves its alert history pointing at nothing.
 */
export async function deactivateAnimal(tag: string, options: ServiceOptions = {}): Promise<Animal> {
  const body = await postJson<unknown>(
    `/api/animals/${encodeURIComponent(tag)}/deactivate`, undefined,
    { ...options, headers: authHeaders() },
  )
  return toAnimal(parseAnimal(body))
}

/** Whether an ear tag is taken, for the registration form. */
export async function tagExists(tag: string, options: ServiceOptions = {}): Promise<boolean> {
  const body = await getJson<{ exists?: unknown }>(
    `/api/animals/${encodeURIComponent(tag)}/exists`,
    { ...options, headers: authHeaders() },
  )
  return body.exists === true
}

/** Farm-wide count from the vision service, with the time it was taken. Not the sum of what camera images show. */
export interface HerdCount { count: number; countedAt: Date }

export function getDetectedCattleCount(options: ServiceOptions = {}): Promise<Sourced<HerdCount | null>> {
  return resolveMockOnly(options, now => ({ count: mockDetectedCattle, countedAt: new Date(now) }))
}
