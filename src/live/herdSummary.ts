import { useState } from 'react'
import type { FarmPlan } from '../services/farmLayout'
import type { TrackedEntity } from './herdTracker'

export interface ZoneSummary {
  lotId: string
  lotName: string
  total: number
  inside: number
  outside: number
  people: number
  breached: boolean
  /** The lot has a camera watching it; without one its count is unknown, not zero. */
  watched: boolean
}

/** Head count per lot from what the cameras see right now. */
export function zoneSummaries(plan: FarmPlan, entities: readonly TrackedEntity[]): ZoneSummary[] {
  const watched = new Set(plan.cameras.map(camera => camera.lotId))
  return plan.lots.map(lot => {
    const here = entities.filter(entity => entity.lotId === lot.id)
    const cows = here.filter(entity => entity.kind === 'cow')
    const outside = cows.filter(entity => entity.outside).length
    return {
      lotId: lot.id, lotName: lot.name, total: cows.length, inside: cows.length - outside, outside,
      people: here.filter(entity => entity.kind === 'person').length, breached: outside > 0, watched: watched.has(lot.id),
    }
  })
}

export interface HerdLogEntry {
  id: string
  type: 'exit' | 'return'
  name: string
  lotName: string
  time: Date
}

export function eventSentence(entry: Pick<HerdLogEntry, 'type' | 'name' | 'lotName'>): string {
  return entry.type === 'exit' ? `${entry.name} salió de ${entry.lotName}` : `${entry.name} volvió a ${entry.lotName}`
}

const LOG_LIMIT = 40

/**
 * Exits and returns seen in this session: an animal tracked by its camera crossing its zone's lindero.
 * Count-only animals are skipped, since the AI does not say which one moved.
 */
interface ExitLogState {
  entities: readonly TrackedEntity[] | null
  outside: ReadonlyMap<string, boolean>
  log: HerdLogEntry[]
  announcement: string
  serial: number
}

/** Pure step of the exit log: compares who is outside now with the previous update. */
export function advanceExitLog(state: ExitLogState, plan: FarmPlan, entities: readonly TrackedEntity[], now: Date): ExitLogState {
  const names = new Map(plan.lots.map(lot => [lot.id, lot.name]))
  const entries: HerdLogEntry[] = []
  const outside = new Map<string, boolean>()
  let serial = state.serial
  for (const entity of entities) {
    if (entity.kind !== 'cow' || entity.source !== 'box') continue
    outside.set(entity.id, entity.outside)
    const before = state.outside.get(entity.id)
    if (before === undefined || before === entity.outside) continue
    serial += 1
    entries.push({
      id: `${entity.id}-${serial}`, type: entity.outside ? 'exit' : 'return',
      name: entity.trackId === null ? 'Una vaca' : `Vaca #${entity.trackId}`, lotName: names.get(entity.lotId) ?? entity.lotId, time: now,
    })
  }
  return {
    entities, outside, serial,
    log: entries.length ? [...entries.reverse(), ...state.log].slice(0, LOG_LIMIT) : state.log,
    announcement: entries.length ? entries.map(eventSentence).join('. ') : state.announcement,
  }
}

const emptyLog: ExitLogState = { entities: null, outside: new Map(), log: [], announcement: '', serial: 0 }

export function useExitLog(plan: FarmPlan | null, entities: readonly TrackedEntity[]) {
  const [state, setState] = useState(emptyLog)
  // Adjusting state while rendering: the log follows each new set of entities without an extra effect pass.
  if (plan && state.entities !== entities) setState(advanceExitLog(state, plan, entities, new Date()))
  return { log: state.log, announcement: state.announcement }
}
