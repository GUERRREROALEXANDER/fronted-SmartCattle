import { useCallback, useEffect, useRef, useState } from 'react'
import type { DataSource, Sourced } from '../types/domain'

export type ResourceState<T> =
  | { status: 'loading'; data: null; source: null; error: null }
  | { status: 'success'; data: T; source: DataSource; error: null }
  | { status: 'error'; data: T | null; source: DataSource | null; error: unknown }

interface UseResourceOptions {
  /** Reload in the background every N ms. Previous data stays on screen while reloading. */
  refreshMs?: number
  /** Changing the key starts a fresh load (e.g. when the selected camera changes). */
  key?: string
}

const loading = { status: 'loading', data: null, source: null, error: null } as const

/**
 * Loads one service call, cancels it on unmount and optionally polls it.
 * A failed background refresh keeps the last good data and exposes the error.
 */
export function useResource<T>(
  load: (signal: AbortSignal) => Promise<Sourced<T>>,
  { refreshMs, key = '' }: UseResourceOptions = {},
): ResourceState<T> & { reload: () => void } {
  const [entry, setEntry] = useState<{ key: string; state: ResourceState<T> }>({ key, state: loading })
  const [attempt, setAttempt] = useState(0)
  const loadRef = useRef(load)
  useEffect(() => { loadRef.current = load })

  useEffect(() => {
    const controller = new AbortController()
    let timer: ReturnType<typeof setTimeout> | undefined

    const run = async () => {
      try {
        const result = await loadRef.current(controller.signal)
        if (controller.signal.aborted) return
        setEntry({ key, state: { status: 'success', data: result.data, source: result.source, error: null } })
      } catch (error) {
        if (controller.signal.aborted) return
        setEntry(previous => {
          const last = previous.key === key ? previous.state : loading
          return { key, state: { status: 'error', data: last.data, source: last.source, error } }
        })
      }
      if (refreshMs && !controller.signal.aborted) timer = setTimeout(run, refreshMs)
    }

    void run()
    return () => {
      controller.abort()
      if (timer) clearTimeout(timer)
    }
  }, [attempt, refreshMs, key])

  const reload = useCallback(() => {
    setEntry(previous => ({ key: previous.key, state: loading }))
    setAttempt(value => value + 1)
  }, [])

  // Data loaded for a previous key is never shown for the new one.
  const state = entry.key === key ? entry.state : loading
  return { ...state, reload }
}
