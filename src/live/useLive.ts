import { createContext, useContext } from 'react'
import type { Alert } from '../types/domain'
import { initialLiveState, type LiveState } from './liveState'

export interface LiveContextValue extends LiveState {
  /** Acknowledges or resolves an alert and reflects it at once, before the push confirms it. */
  updateAlert: (id: string, action: 'acknowledge' | 'resolve') => Promise<Alert>
  /** Re-reads metrics, cameras and alerts from the backend now. */
  refresh: () => void
}

export const LiveContext = createContext<LiveContextValue>({
  ...initialLiveState,
  updateAlert: () => Promise.reject(new Error('LiveProvider is missing')),
  refresh: () => {},
})

export function useLive(): LiveContextValue {
  return useContext(LiveContext)
}
