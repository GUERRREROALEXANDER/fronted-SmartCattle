import { useCallback, useEffect, useRef, useState } from 'react'
import type { DataSource, Sourced } from '../types/domain'

export type ResourceState<T> =
  | { status: 'loading'; data: null; source: null; error: null }
  | { status: 'success'; data: T; source: DataSource; error: null }
  | { status: 'error'; data: T | null; source: DataSource | null; error: unknown }

interface UseResourceOptions {
  /** Reload in the background every N ms. Previous data stays on screen while reloading. */
  refreshMs?: number
}

/**
 * Loads one service call, cancels it on unmount and optionally polls it.
 * A failed background refresh keeps the last good data and exposes the error.
 */
export function useResource<T>(
  load: (signal: AbortSignal) => Promise<Sourced<T>>,
  { refreshMs }: UseResourceOptions = {},
): ResourceState<T> & { reload: () => void } {
  const [state, setState] = useState<ResourceState<T>>({ status: 'loading', data: null, source: null, error: null })
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
        setState({ status: 'success', data: result.data, source: result.source, error: null })
      } catch (error) {
        if (controller.signal.aborted) return
        setState(previous => ({ status: 'error', data: previous.data, source: previous.source, error }))
      }
      if (refreshMs && !controller.signal.aborted) timer = setTimeout(run, refreshMs)
    }

    void run()
    return () => {
      controller.abort()
      if (timer) clearTimeout(timer)
    }
  }, [attempt, refreshMs])

  const reload = useCallback(() => {
    setState({ status: 'loading', data: null, source: null, error: null })
    setAttempt(value => value + 1)
  }, [])

  return { ...state, reload }
}
