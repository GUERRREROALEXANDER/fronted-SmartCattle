import {
  getCurrentFarm, getRegisteredCattleCount, getSecurityHours, getSystemStatus, loadCameraSnapshots,
} from '../../services'
import { useResource } from '../../lib/useResource'

// Cameras, alerts, events and metrics come from the live channel; these are the slower facts around them.
const refreshMs = 15_000

export function useDashboardData(cameraIds: readonly string[]) {
  const ids = cameraIds.join(',')
  return {
    snapshots: useResource(signal => loadCameraSnapshots([...cameraIds], signal), { key: ids, refreshMs }),
    farm: useResource(signal => getCurrentFarm({ signal })),
    status: useResource(signal => getSystemStatus({ signal }), { refreshMs }),
    registered: useResource(signal => getRegisteredCattleCount({ signal })),
    securityHours: useResource(signal => getSecurityHours({ signal })),
  }
}

export type DashboardData = ReturnType<typeof useDashboardData>
