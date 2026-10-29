import { dataMode } from '../api/config'
import { authHeaders } from '../api/session'
import { deleteJson, getJson, patchJson, postJson } from '../api/httpClient'
import { parseZone, parseZonesResponse } from '../api/validate'
import { mockSafeZones } from '../mocks/mockData'
import type { ApiZone } from '../types/api'
import type { NormalizedBounds, NormalizedPoint, SafeZone, Sourced } from '../types/domain'
import { resolveSource } from './dataSource'
import { waitForMock, type ServiceOptions } from './options'

/**
 * A zone as the interface uses it.
 *
 * `bounds` is the rectangle and `outline` the optional polygon, the same shape
 * SafeZone already had -- so the editor and the overlays did not need to
 * change when zones stopped being local state.
 */
export function toSafeZone(zone: ApiZone): SafeZone & { active: boolean } {
  const bounds: NormalizedBounds = [zone.x_min, zone.y_min, zone.x_max, zone.y_max]
  return {
    id: String(zone.id),
    cameraId: zone.camera_id,
    name: zone.name,
    bounds,
    ...(zone.outline ? { outline: zone.outline.map(point => [point.x, point.y] as NormalizedPoint) } : {}),
    active: zone.active,
  }
}

/** What the backend needs to store a zone. Coordinates are 0..1, not pixels. */
export interface ZoneDraft {
  name: string
  bounds: NormalizedBounds
  outline?: readonly NormalizedPoint[]
}

function toApiBody(draft: ZoneDraft) {
  const [xMin, yMin, xMax, yMax] = draft.bounds
  return {
    name: draft.name.trim(),
    x_min: xMin, y_min: yMin, x_max: xMax, y_max: yMax,
    outline: draft.outline?.length
      ? draft.outline.map(([x, y]) => ({ x, y }))
      : null,
  }
}

export async function listSafeZones(
  cameraId?: string,
  options: ServiceOptions = {},
): Promise<Sourced<SafeZone[] | null>> {
  const source = resolveSource('backend', options.mode ?? dataMode)
  if (source === 'mock') {
    await waitForMock(options)
    const zones = cameraId ? mockSafeZones.filter(zone => zone.cameraId === cameraId) : mockSafeZones
    return { data: zones.map(zone => ({ ...zone, bounds: [...zone.bounds] as NormalizedBounds })), source }
  }
  const query = cameraId ? `?camera_id=${encodeURIComponent(cameraId)}` : ''
  const response = parseZonesResponse(await getJson<unknown>(`/api/zones${query}`, {
    ...options, headers: authHeaders(),
  }))
  return { data: response.items.map(toSafeZone), source }
}

/**
 * Stores a safe zone for a camera. Owner only on the backend.
 *
 * The camera is in the path because a zone belongs to one camera and cannot
 * be moved: it cascades with the camera, so moving one means deleting and
 * recreating it.
 */
export async function createSafeZone(
  cameraId: string,
  draft: ZoneDraft,
  options: ServiceOptions = {},
): Promise<SafeZone> {
  const body = await postJson<unknown>(
    `/api/zones/camera/${encodeURIComponent(cameraId)}`, toApiBody(draft),
    { ...options, headers: authHeaders() },
  )
  return toSafeZone(parseZone(body))
}

/**
 * Updates a zone. The geometry is replaced as a whole when given.
 *
 * A single corner cannot be validated against the others without knowing
 * them, which is why the backend takes the rectangle together rather than
 * field by field.
 */
export async function updateSafeZone(
  zoneId: string,
  changes: { name?: string; active?: boolean; geometry?: ZoneDraft },
  options: ServiceOptions = {},
): Promise<SafeZone> {
  const body: Record<string, unknown> = {}
  if (changes.name !== undefined) body.name = changes.name.trim()
  if (changes.active !== undefined) body.active = changes.active
  if (changes.geometry) body.geometry = toApiBody(changes.geometry)

  const response = await patchJson<unknown>(`/api/zones/${encodeURIComponent(zoneId)}`, body, {
    ...options, headers: authHeaders(),
  })
  return toSafeZone(parseZone(response))
}

/**
 * Removes a zone. A real delete, unlike an animal.
 *
 * A zone is configuration and not history: nothing references it that would
 * be orphaned, and keeping a retired rectangle would leave one camera with two
 * zones and no way to say which the AI service should use.
 */
export async function deleteSafeZone(zoneId: string, options: ServiceOptions = {}): Promise<void> {
  await deleteJson<void>(`/api/zones/${encodeURIComponent(zoneId)}`, {
    ...options, headers: authHeaders(),
  })
}
