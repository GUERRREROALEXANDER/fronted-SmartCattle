export type LuciaMood = 'idle' | 'thinking' | 'talking'

const TALK_MS_PER_CHARACTER = 28
const TALK_MIN_MS = 1200
const TALK_MAX_MS = 5000

/** How long she keeps talking after an answer: a long one takes longer, and none goes on forever. */
export function talkingMs(text: string): number {
  return Math.min(TALK_MAX_MS, Math.max(TALK_MIN_MS, text.length * TALK_MS_PER_CHARACTER))
}

export function luciaMood(busy: boolean, talking: boolean): LuciaMood {
  if (busy) return 'thinking'
  return talking ? 'talking' : 'idle'
}
