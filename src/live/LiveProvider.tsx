import { useCallback, useEffect, useMemo, useReducer, useRef, type ReactNode } from 'react'
import { apiBaseUrl, dataMode } from '../api/config'
import { ApiError } from '../api/errors'
import { tokenStore } from '../api/session'
import { alarm } from '../lib/alarm'
import { eventCatalog } from '../lib/eventCatalog'
import { acknowledgeAlert, getLiveMetrics, listAlerts, listAllCameras, listEvents, resolveAlert } from '../services'
import type { Alert, Camera } from '../types/domain'
import { liveSocketUrl, openLiveSocket, type SocketState } from './liveSocket'
import { initialLiveState, liveReducer, type LiveConnection } from './liveState'
import { LiveContext, type LiveContextValue } from './useLive'

/** Without pushes the data is re-read this often; with pushes, only as a safety net. */
const POLL_MS = 5_000
const SAFETY_REFRESH_MS = 60_000
const PRUNE_MS = 2_000

function alarmReason(alert: Alert, cameras: readonly Camera[]): string {
  const label = alert.kind ? eventCatalog[alert.kind].label : alert.message
  if (!alert.cameraId) return label
  return `${label} · ${cameras.find(camera => camera.id === alert.cameraId)?.name ?? alert.cameraId}`
}

/**
 * Keeps one live picture of the farm for every page: a first snapshot from the REST API, then the
 * /ws/live pushes. Falls back to polling when the backend cannot push, and to the demo generator in
 * mock mode.
 */
export function LiveProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(liveReducer, initialLiveState)
  const refreshRef = useRef<() => void>(() => {})

  useEffect(() => {
    const controller = new AbortController()
    const { signal } = controller
    let socketState: SocketState = 'connecting'
    let pollTimer: ReturnType<typeof setTimeout> | undefined
    let refreshing = false

    const connection = (value: LiveConnection) => dispatch({ type: 'connection', connection: value })

    const load = async () => {
      if (refreshing || signal.aborted) return
      refreshing = true
      try {
        const [metrics, cameras, alerts, events] = await Promise.all([
          getLiveMetrics({ signal }), listAllCameras({ signal }), listAlerts({ limit: 100 }, { signal }), listEvents({ signal }),
        ])
        dispatch({
          type: 'snapshot', at: new Date(), metrics: metrics.data, cameras: cameras.data,
          alerts: alerts.data, events: events.data.slice(0, 60),
        })
        if (dataMode !== 'mock') connection(socketState === 'live' ? 'live' : 'polling')
      } catch (error) {
        if (signal.aborted) return
        // A rejected token is handled by the auth layer; anything else means the backend is out of reach.
        if (!(error instanceof ApiError && error.status === 401)) connection('offline')
      } finally {
        refreshing = false
      }
    }

    const schedule = () => {
      clearTimeout(pollTimer)
      if (signal.aborted) return
      pollTimer = setTimeout(async () => {
        await load()
        schedule()
      }, socketState === 'live' ? SAFETY_REFRESH_MS : POLL_MS)
    }
    refreshRef.current = () => { void load() }

    let stopFeed: () => void = () => {}
    if (dataMode === 'mock') {
      connection('demo')
      void import('../mocks/mockLiveFeed').then(({ startMockLiveFeed }) => {
        if (signal.aborted) return
        void load()
        stopFeed = startMockLiveFeed(message => dispatch({ type: 'message', at: new Date(), message }))
      })
    } else {
      void load().then(schedule)
      const socket = openLiveSocket({
        url: liveSocketUrl(apiBaseUrl),
        getToken: () => tokenStore.get(),
        onMessage: message => dispatch({ type: 'message', at: new Date(), message }),
        onState: next => {
          const wasLive = socketState === 'live'
          socketState = next
          if (next === 'live') {
            connection('live')
            // A reconnect may have missed pushes: re-read once to catch up.
            if (!wasLive) void load()
            schedule()
          } else if (wasLive) {
            connection('polling')
            schedule()
          }
          if (next === 'unauthorized' && tokenStore.get()) tokenStore.reject()
        },
      })
      stopFeed = () => socket.close()
    }

    const prune = setInterval(() => dispatch({ type: 'prune', at: new Date() }), PRUNE_MS)
    return () => {
      controller.abort()
      clearTimeout(pollTimer)
      clearInterval(prune)
      stopFeed()
    }
  }, [])

  // Open critical alerts sound the app-wide siren until someone acknowledges them.
  const alarmed = useRef(new Set<string>())
  useEffect(() => {
    const critical = new Map(state.alerts.filter(alert => alert.status === 'open' && alert.severity === 'critical').map(alert => [alert.id, alert]))
    for (const [id, alert] of critical) {
      if (!alarmed.current.has(id)) alarm.raise(`alert:${id}`, alarmReason(alert, state.cameras))
    }
    for (const id of alarmed.current) if (!critical.has(id)) alarm.clear(`alert:${id}`)
    alarmed.current = new Set(critical.keys())
  }, [state.alerts, state.cameras])
  useEffect(() => () => { for (const id of alarmed.current) alarm.clear(`alert:${id}`) }, [])

  const updateAlert = useCallback(async (id: string, action: 'acknowledge' | 'resolve') => {
    const alert = await (action === 'acknowledge' ? acknowledgeAlert(id) : resolveAlert(id))
    dispatch({ type: 'message', at: new Date(), message: { type: 'alert.updated', alert } })
    return alert
  }, [])
  const refresh = useCallback(() => refreshRef.current(), [])

  const value = useMemo<LiveContextValue>(() => ({ ...state, updateAlert, refresh }), [state, updateAlert, refresh])
  return <LiveContext.Provider value={value}>{children}</LiveContext.Provider>
}
