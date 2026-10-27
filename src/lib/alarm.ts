import { useEffect, useSyncExternalStore } from 'react'
import { safeStorage } from './safeStorage'

// App-wide security alarm: one audible siren and one visual state shared by every
// feature that detects an animal outside its zone (dashboard plan, video analysis).

const MUTE_KEY = 'smartcattle.alarm.muted'
const SIREN_GAP_MS = 2500

export interface AlarmState {
  /** Ids of the sources currently raising the alarm (e.g. "plan:cow-12", "video:abc"). */
  active: readonly string[]
  muted: boolean
  /** Human-readable reason of the most recent trigger, in Spanish. */
  lastReason: string | null
}

type Listener = () => void

let state: AlarmState = {
  active: [],
  muted: safeStorage.getJson<boolean>(MUTE_KEY) ?? false,
  lastReason: null,
}
const listeners = new Set<Listener>()
let audio: AudioContext | null = null
let lastSirenAt = 0

function emit(next: AlarmState) {
  state = next
  listeners.forEach((listener) => listener())
}

/** Two-tone siren synthesized with Web Audio, so no audio asset ships with the app. */
function playSiren() {
  if (state.muted || typeof window === 'undefined' || !('AudioContext' in window)) return
  const now = performance.now()
  if (now - lastSirenAt < SIREN_GAP_MS) return
  lastSirenAt = now
  try {
    audio ??= new AudioContext()
    // Browsers keep the context suspended until a user gesture; resume is a no-op afterwards.
    void audio.resume()
    const start = audio.currentTime
    const osc = audio.createOscillator()
    const gain = audio.createGain()
    osc.type = 'triangle'
    for (let i = 0; i < 4; i++) osc.frequency.setValueAtTime(i % 2 ? 660 : 880, start + i * 0.22)
    gain.gain.setValueAtTime(0.0001, start)
    gain.gain.exponentialRampToValueAtTime(0.18, start + 0.03)
    gain.gain.setValueAtTime(0.18, start + 0.8)
    gain.gain.exponentialRampToValueAtTime(0.0001, start + 0.9)
    osc.connect(gain).connect(audio.destination)
    osc.start(start)
    osc.stop(start + 0.92)
  } catch {
    // Audio is a bonus over the visual alarm; never let it break the page.
  }
}

export const alarm = {
  getState: (): AlarmState => state,
  subscribe(listener: Listener) {
    listeners.add(listener)
    return () => { listeners.delete(listener) }
  },
  /** Starts (or keeps) the alarm for a source. Repeated calls re-sound the siren at most every 2.5 s. */
  raise(sourceId: string, reason: string) {
    const active = state.active.includes(sourceId) ? state.active : [...state.active, sourceId]
    emit({ ...state, active, lastReason: reason })
    playSiren()
  },
  clear(sourceId: string) {
    if (!state.active.includes(sourceId)) return
    emit({ ...state, active: state.active.filter((id) => id !== sourceId) })
  },
  setMuted(muted: boolean) {
    safeStorage.setJson(MUTE_KEY, muted)
    emit({ ...state, muted })
  },
}

export function useAlarmState(): AlarmState {
  return useSyncExternalStore(alarm.subscribe, alarm.getState, alarm.getState)
}

/** Raises the alarm for `sourceId` while `outside` is true and clears it on unmount. */
export function useZoneAlarm(sourceId: string, outside: boolean, reason: string) {
  useEffect(() => {
    if (outside) alarm.raise(sourceId, reason)
    else alarm.clear(sourceId)
  }, [sourceId, outside, reason])
  useEffect(() => () => alarm.clear(sourceId), [sourceId])
}
