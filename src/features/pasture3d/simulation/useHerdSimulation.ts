import { useCallback, useEffect, useRef, useState } from 'react'
import type { FarmPlan } from '../../../mocks/mockFarmPlan'
import { pointInPolygon } from './geometry'
import {
  createHerdSimulation,
  forceEscape as requestForcedEscape,
  getZoneSummaries,
  jumpToEscapeTarget,
  step,
  type HerdEvent,
  type HerdSimulation,
  type ZoneSummary,
} from './herdSimulation'
import { mulberry32 } from './rng'

const MAX_FRAME_SECONDS = 0.1
const LOG_LIMIT = 40

export interface HerdLogEntry {
  id: string
  type: HerdEvent['type']
  cowId: string
  cowName: string
  lotId: string
  lotName: string
  /** Wall-clock time the event was seen in this session. */
  time: Date
}

export interface ForcedEscape {
  cowId: string
  lotId: string
}

export interface HerdSimulationController {
  simulation: HerdSimulation
  zones: ZoneSummary[]
  escapedCowIds: ReadonlySet<string>
  log: HerdLogEntry[]
  /** Latest exit/return sentence, for the aria-live region. */
  announcement: string
  paused: boolean
  setPaused: (paused: boolean) => void
  forceEscape: () => ForcedEscape | null
  /** Advances the simulation; the scene calls it from useFrame. Kept free of three.js so the page chunk stays light. */
  tick: (delta: number) => void
}

export interface UseHerdSimulationOptions {
  plan: FarmPlan
  seed?: number
  startPaused?: boolean
}

function zonesKey(zones: readonly ZoneSummary[]) {
  return zones.map(zone => `${zone.lotId}:${zone.inside}/${zone.total}`).join('|')
}

function escapedKey(simulation: HerdSimulation) {
  return simulation.cows.filter(cow => cow.escaped).map(cow => cow.id).join('|')
}

export function eventSentence(entry: Pick<HerdLogEntry, 'type' | 'cowName' | 'lotName'>) {
  return entry.type === 'exit'
    ? `${entry.cowName} salió de ${entry.lotName}`
    : `${entry.cowName} volvió a ${entry.lotName}`
}

export function useHerdSimulation({
  plan,
  seed = 20_260_315,
  startPaused = false,
}: UseHerdSimulationOptions): HerdSimulationController {
  const [rng] = useState(() => mulberry32(seed))
  const [simulation] = useState(() => createHerdSimulation(plan, rng))
  const [zones, setZones] = useState(() => getZoneSummaries(simulation))
  const [escapedCowIds, setEscapedCowIds] = useState<ReadonlySet<string>>(() => new Set())
  const [log, setLog] = useState<HerdLogEntry[]>([])
  const [announcement, setAnnouncement] = useState('')
  const [paused, setPaused] = useState(startPaused)
  const pausedRef = useRef(startPaused)
  const zonesKeyRef = useRef(zonesKey(zones))
  const escapedKeyRef = useRef('')
  const entrySerial = useRef(0)

  useEffect(() => {
    pausedRef.current = paused
  }, [paused])

  // Only pushes React state when something visible changed, never per frame.
  const publish = useCallback((events: readonly HerdEvent[]) => {
    const nextZones = getZoneSummaries(simulation)
    const nextZonesKey = zonesKey(nextZones)
    if (nextZonesKey !== zonesKeyRef.current) {
      zonesKeyRef.current = nextZonesKey
      setZones(nextZones)
    }

    const nextEscapedKey = escapedKey(simulation)
    if (nextEscapedKey !== escapedKeyRef.current) {
      escapedKeyRef.current = nextEscapedKey
      setEscapedCowIds(new Set(nextEscapedKey ? nextEscapedKey.split('|') : []))
    }

    if (events.length === 0) return

    const now = new Date()
    const entries = events.map((event): HerdLogEntry => {
      entrySerial.current += 1
      return {
        id: `${event.type}-${event.cowId}-${entrySerial.current}`,
        type: event.type,
        cowId: event.cowId,
        cowName: event.cowName,
        lotId: event.lotId,
        lotName: simulation.lots.find(lot => lot.id === event.lotId)?.name ?? event.lotId,
        time: now,
      }
    })
    setLog(previous => [...entries.reverse(), ...previous].slice(0, LOG_LIMIT))
    setAnnouncement(entries.map(eventSentence).join('. '))
  }, [simulation])

  const tick = useCallback((delta: number) => {
    if (pausedRef.current) return
    publish(step(simulation, Math.min(delta, MAX_FRAME_SECONDS), rng))
  }, [publish, rng, simulation])

  const forceEscape = useCallback((): ForcedEscape | null => {
    const candidates = simulation.cows.filter(cow => {
      if (cow.escaped || cow.escapeRequested) return false
      const lot = simulation.lots.find(item => item.id === cow.lotId)
      return lot !== undefined && pointInPolygon(cow.position, lot.boundary)
    })
    if (candidates.length === 0) return null

    const cow = candidates[Math.floor(rng() * candidates.length)]
    if (!requestForcedEscape(simulation, cow.id, rng)) return null

    // While paused (or with reduced motion) the cow steps straight out instead of walking.
    if (pausedRef.current) {
      jumpToEscapeTarget(simulation, cow.id)
      publish(step(simulation, 1e-4, rng))
    }
    return { cowId: cow.id, lotId: cow.lotId }
  }, [publish, rng, simulation])

  return {
    simulation,
    zones,
    escapedCowIds,
    log,
    announcement,
    paused,
    setPaused,
    forceEscape,
    tick,
  }
}
