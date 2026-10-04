import {
  getCurrentFarm, getDetectedCattleCount, getFarmPlan, getRegisteredCattleCount, getSecurityHours,
  getSystemStatus, listCameras, listEvents, loadCameraSnapshots,
} from '../../services'
import { useResource } from '../../lib/useResource'

const liveRefreshMs = 15_000

export function useDashboardData() {
  const cameras = useResource(signal => listCameras({ signal }), { refreshMs: liveRefreshMs })
  const ids = (cameras.data ?? []).map(camera => camera.id)
  return {
    cameras,
    snapshots: useResource(signal => loadCameraSnapshots(ids, signal), { key: ids.join(','), refreshMs: liveRefreshMs }),
    farm: useResource(signal => getCurrentFarm({ signal })),
    status: useResource(signal => getSystemStatus({ signal }), { refreshMs: liveRefreshMs }),
    events: useResource(signal => listEvents({ signal }), { refreshMs: liveRefreshMs }),
    registered: useResource(signal => getRegisteredCattleCount({ signal })),
    detected: useResource(signal => getDetectedCattleCount({ signal }), { refreshMs: liveRefreshMs }),
    plan: useResource(signal => getFarmPlan({ signal })),
    securityHours: useResource(signal => getSecurityHours({ signal })),
  }
}

export type DashboardData = ReturnType<typeof useDashboardData>
