import type { Animal } from '../types/domain'

/**
 * A demo herd for mock mode.
 *
 * Chosen to cover the cases a list has to handle rather than to look full:
 * an animal nobody has located, one never detected, one inactive and one lost.
 * A demo made only of healthy rows hides every branch worth seeing.
 */
export function buildMockHerd(now: Date | undefined = undefined): Animal[] {
  const reference = now ?? new Date()
  const hoursAgo = (hours: number) => new Date(reference.getTime() - hours * 3_600_000)
  const created = new Date(reference.getTime() - 30 * 24 * 3_600_000)

  return [
    { tag: 'A-101', name: 'Lucera', status: 'active', cameraId: 'camera-01', lastDetection: hoursAgo(1), createdAt: created, updatedAt: hoursAgo(1) },
    { tag: 'A-102', name: 'Manchas', status: 'active', cameraId: 'camera-01', lastDetection: hoursAgo(2), createdAt: created, updatedAt: hoursAgo(2) },
    { tag: 'A-103', name: 'Canela', status: 'active', cameraId: 'camera-02', lastDetection: hoursAgo(5), createdAt: created, updatedAt: hoursAgo(5) },
    { tag: 'A-104', name: 'Nube', status: 'active', cameraId: 'camera-02', lastDetection: hoursAgo(26), createdAt: created, updatedAt: hoursAgo(26) },
    // Registered and never seen: the row a badly written filter hides, and the
    // one worth looking at first.
    { tag: 'A-105', name: 'Sin ubicar', status: 'active', cameraId: null, lastDetection: null, createdAt: created, updatedAt: created },
    { tag: 'A-106', name: null, status: 'active', cameraId: 'camera-03', lastDetection: hoursAgo(3), createdAt: created, updatedAt: hoursAgo(3) },
    { tag: 'A-107', name: 'Lucero', status: 'lost', cameraId: 'camera-03', lastDetection: hoursAgo(50), createdAt: created, updatedAt: hoursAgo(50) },
    { tag: 'A-108', name: 'Vendida', status: 'inactive', cameraId: null, lastDetection: hoursAgo(400), createdAt: created, updatedAt: hoursAgo(400) },
  ]
}
