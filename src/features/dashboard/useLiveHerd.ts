import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useReducedMotion } from 'motion/react'
import type { FarmPlan } from '../../services'
import { mulberry32 } from '../pasture3d/simulation/rng'
import {
  appendLiveChartPoint,
  createLiveHerd,
  forceCowExit,
  getLiveHerdSnapshot,
  jumpCowOutside,
  stepLiveHerd,
  type LiveChartPoint,
} from './liveHerd'

const SIMULATION_SEED = 0x5A17C0DE

const clockFormat = new Intl.DateTimeFormat('es-CO', { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false })
const clockLabel = () => clockFormat.format(new Date())

export function useLiveHerd(plan: FarmPlan) {
  const reduceMotion = useReducedMotion() === true
  const session = useMemo(() => {
    const rng = mulberry32(SIMULATION_SEED)
    return { rng, simulation: createLiveHerd(plan, rng) }
  }, [plan])
  const { rng, simulation } = session
  const [snapshot, setSnapshot] = useState(() => getLiveHerdSnapshot(simulation))
  const [baseline, setBaseline] = useState(snapshot)
  const [points, setPoints] = useState<LiveChartPoint[]>(() => appendLiveChartPoint([], snapshot, clockLabel()))
  const [paused, setPaused] = useState(false)
  const [speed, setSpeed] = useState<1 | 2>(1)
  const pausedRef = useRef(paused)
  const speedRef = useRef(speed)

  useEffect(() => { pausedRef.current = paused }, [paused])
  useEffect(() => { speedRef.current = speed }, [speed])

  // A new plan starts a new session: metrics and the chart compare against its own start.
  const [sessionSeen, setSessionSeen] = useState(session)
  if (sessionSeen !== session) {
    const initial = getLiveHerdSnapshot(simulation)
    setSessionSeen(session)
    setSnapshot(initial)
    setBaseline(initial)
    setPoints(appendLiveChartPoint([], initial, clockLabel()))
  }

  const publish = useCallback(() => {
    const next = getLiveHerdSnapshot(simulation)
    setSnapshot(next)
    setPoints(current => appendLiveChartPoint(current, next, clockLabel()))
  }, [simulation])

  useEffect(() => {
    let animationFrame = 0
    let previousTime = performance.now()
    let publishElapsed = 0
    let reducedElapsed = 0

    const frame = (time: number) => {
      const realDt = Math.min(0.25, Math.max(0, (time - previousTime) / 1000))
      previousTime = time
      if (!pausedRef.current) {
        if (reduceMotion) {
          // Reduced motion: the herd moves in one-second steps instead of gliding.
          reducedElapsed += realDt
          if (reducedElapsed >= 1) {
            stepLiveHerd(simulation, reducedElapsed * speedRef.current, rng)
            reducedElapsed = 0
            publish()
          }
        } else {
          const events = stepLiveHerd(simulation, realDt * speedRef.current, rng)
          publishElapsed += realDt
          if (events.length > 0 || publishElapsed >= 1) {
            publishElapsed = 0
            publish()
          }
        }
      }
      animationFrame = requestAnimationFrame(frame)
    }
    animationFrame = requestAnimationFrame(frame)
    return () => cancelAnimationFrame(animationFrame)
  }, [publish, reduceMotion, rng, simulation])

  const simulateExit = useCallback(() => {
    const cowId = forceCowExit(simulation, rng)
    // Paused or stepped views would hide the walk out, so place the cow outside at once.
    if (cowId && (pausedRef.current || reduceMotion)) {
      jumpCowOutside(simulation, cowId)
      stepLiveHerd(simulation, 0.001, rng)
      publish()
    }
    return cowId === null ? null : simulation.cows.find(cow => cow.id === cowId) ?? null
  }, [publish, reduceMotion, rng, simulation])

  const toggleSpeed = useCallback(() => setSpeed(current => current === 1 ? 2 : 1), [])

  return { simulation, snapshot, baseline, points, paused, speed, reduceMotion, setPaused, toggleSpeed, simulateExit }
}

export type LiveHerdController = ReturnType<typeof useLiveHerd>
