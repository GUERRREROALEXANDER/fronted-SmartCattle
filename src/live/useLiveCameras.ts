import { useMemo } from 'react'
import { dataMode } from '../api/config'
import type { ResourceState } from '../lib/useResource'
import type { Camera } from '../types/domain'
import { useLive } from './useLive'

export type LiveCamerasState = ResourceState<Camera[]> & { reload: () => void }

/**
 * The cameras from the live channel, shaped like a `useResource` result so a page can swap its own
 * polling for it. A status change pushed by the AI service reaches every page at once.
 * `onlineOnly` keeps the old `listCameras` meaning (cameras that deliver a picture right now).
 */
export function useLiveCameras({ onlineOnly = false } = {}): LiveCamerasState {
  const { cameras, updatedAt, connection, refresh } = useLive()
  const loaded = updatedAt !== null
  const offline = connection === 'offline'
  return useMemo<LiveCamerasState>(() => {
    const data = onlineOnly ? cameras.filter(camera => camera.status === 'online') : cameras
    const source = dataMode === 'mock' ? 'mock' : 'api'
    if (offline) return { status: 'error', data: loaded ? data : null, source: loaded ? source : null, error: new Error('offline'), reload: refresh }
    if (!loaded) return { status: 'loading', data: null, source: null, error: null, reload: refresh }
    return { status: 'success', data, source, error: null, reload: refresh }
  }, [cameras, loaded, offline, onlineOnly, refresh])
}
