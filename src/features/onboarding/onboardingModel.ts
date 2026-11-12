import { safeStorage } from '../../lib/safeStorage'

// What each account told Lucero the first time. The backend has no place for preferences yet, so they
// live in this browser, under the account's id; another device simply asks again.

export type Goal = 'zone' | 'people' | 'lying' | 'report'
export type StartPage = '/' | '/live' | '/pasture' | '/informe'

export interface OnboardingAnswers {
  goals: Goal[]
  start: StartPage
}

export const GOALS: readonly { id: Goal; title: string; detail: string }[] = [
  { id: 'zone', title: 'Que no se salgan', detail: 'Avisarme si un animal deja su zona segura.' },
  { id: 'people', title: 'Quién entra', detail: 'Saber cuándo se detecta una persona en la finca.' },
  { id: 'lying', title: 'Cómo está el ganado', detail: 'Ver si está echado, de pie o caminando.' },
  { id: 'report', title: 'Un resumen del día', detail: 'Leer qué pasó sin revisar evento por evento.' },
]

export const START_PAGES: readonly { id: StartPage; title: string; detail: string }[] = [
  { id: '/', title: 'El panel', detail: 'Estado de la finca y alertas.' },
  { id: '/live', title: 'Las cámaras en vivo', detail: 'El video con lo que detecta la IA.' },
  { id: '/pasture', title: 'El potrero 3D', detail: 'La finca dibujada con cada animal.' },
  { id: '/informe', title: 'El informe del día', detail: 'El resumen ya hecho.' },
]

const key = (userId: string) => `smartcattle.onboarding.${userId}`

export function onboardingOf(userId: string): OnboardingAnswers | null {
  return safeStorage.getJson<OnboardingAnswers>(key(userId))
}

export function saveOnboarding(userId: string, answers: OnboardingAnswers): void {
  safeStorage.setJson(key(userId), answers)
}

const SUGGESTIONS: Record<Goal, string> = {
  zone: '¿Alguna vaca fuera de zona?',
  people: '¿Hay alertas abiertas?',
  lying: '¿Cómo está el ganado ahora?',
  report: '¿Qué pasó anoche?',
}

/** Lucero's first suggestions lead with what this person said they care about. */
export function suggestionsFor(goals: readonly Goal[], rest: readonly string[]): string[] {
  return [...new Set([...goals.map(goal => SUGGESTIONS[goal]), ...rest])].slice(0, 4)
}
