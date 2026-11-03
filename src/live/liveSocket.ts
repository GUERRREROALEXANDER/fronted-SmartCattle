import { parseLiveMessage, type LiveMessage } from './messages'

export type SocketState =
  /** Opening or waiting for the server's hello. */
  | 'connecting'
  /** Authenticated and receiving pushes. */
  | 'live'
  /** Lost; a reconnect is scheduled. */
  | 'reconnecting'
  /** The backend has no JWT secret (close 4503): pushes are impossible, the caller polls instead. */
  | 'unsupported'
  /** The token was rejected (close 4401): the person has to sign in again. */
  | 'unauthorized'
  | 'closed'

export interface LiveSocketOptions {
  url: string
  getToken: () => string | null
  onMessage: (message: LiveMessage) => void
  onState: (state: SocketState) => void
  createSocket?: (url: string) => WebSocket
  /** Keeps idle proxies (Render, Cloudflare) from dropping a quiet connection. */
  pingEveryMs?: number
  maxBackoffMs?: number
}

export const CLOSE_UNAUTHORIZED = 4401
export const CLOSE_AUTH_NOT_CONFIGURED = 4503

/** http(s)://host → ws(s)://host/ws/live */
export function liveSocketUrl(apiBaseUrl: string): string {
  return `${apiBaseUrl.replace(/^http/, 'ws').replace(/\/+$/, '')}/ws/live`
}

/**
 * One self-healing connection to /ws/live. The token goes in the first message (browsers cannot set
 * headers on a WebSocket, and a token in the URL ends up in access logs). Reconnects with exponential
 * backoff and jitter; stops for good on 4401 and 4503.
 */
export function openLiveSocket(options: LiveSocketOptions): { close: () => void } {
  const { url, getToken, onMessage, onState, pingEveryMs = 25_000, maxBackoffMs = 30_000 } = options
  const createSocket = options.createSocket ?? (target => new WebSocket(target))
  let socket: WebSocket | null = null
  let attempt = 0
  let stopped = false
  let retryTimer: ReturnType<typeof setTimeout> | undefined
  let pingTimer: ReturnType<typeof setInterval> | undefined

  const setState = (state: SocketState) => { if (!stopped || state === 'closed') onState(state) }

  const scheduleRetry = () => {
    if (stopped) return
    setState('reconnecting')
    const base = Math.min(maxBackoffMs, 1000 * 2 ** attempt)
    attempt += 1
    retryTimer = setTimeout(connect, base / 2 + Math.random() * base / 2)
  }

  function connect() {
    const token = getToken()
    if (!token) {
      setState('unauthorized')
      return
    }
    setState('connecting')
    try {
      socket = createSocket(url)
    } catch {
      scheduleRetry()
      return
    }
    const current = socket
    current.onopen = () => current.send(JSON.stringify({ type: 'auth', token }))
    current.onmessage = ({ data }) => {
      const message = parseLiveMessage(data)
      if (!message) return
      if (message.type === 'hello') {
        attempt = 0
        setState('live')
        clearInterval(pingTimer)
        pingTimer = setInterval(() => {
          if (current.readyState === 1) current.send(JSON.stringify({ type: 'ping' }))
        }, pingEveryMs)
      }
      onMessage(message)
    }
    current.onclose = ({ code }) => {
      clearInterval(pingTimer)
      if (stopped || socket !== current) return
      socket = null
      if (code === CLOSE_UNAUTHORIZED) setState('unauthorized')
      else if (code === CLOSE_AUTH_NOT_CONFIGURED) setState('unsupported')
      else scheduleRetry()
    }
    // onclose always follows onerror; the retry is scheduled there.
    current.onerror = () => {}
  }

  connect()

  return {
    close() {
      stopped = true
      clearTimeout(retryTimer)
      clearInterval(pingTimer)
      const current = socket
      socket = null
      if (current && current.readyState <= 1) current.close(1000, 'Dashboard closed')
      onState('closed')
    },
  }
}
