import type { DailyActivity } from '../../types/domain'

export interface PostureShare { key: 'lying' | 'standing' | 'walking'; label: string; minutes: number; share: number }

/** How the observed time split by posture, largest first; empty when no posture was recorded. */
export function postureShares(herd: DailyActivity): PostureShare[] {
  const rows = [
    { key: 'lying' as const, label: 'Echado', minutes: herd.lyingMinutes },
    { key: 'standing' as const, label: 'De pie', minutes: herd.standingMinutes },
    { key: 'walking' as const, label: 'Caminando', minutes: herd.walkingMinutes },
  ]
  const known = rows.reduce((sum, row) => sum + row.minutes, 0)
  if (known === 0) return []
  return rows.map(row => ({ ...row, share: row.minutes / known })).sort((a, b) => b.minutes - a.minutes)
}

export const dayKey = (date: Date) =>
  `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`

export function shiftDay(day: string, by: number): string {
  const [year, month, date] = day.split('-').map(Number)
  return dayKey(new Date(year, month - 1, date + by))
}

export function dayTitle(day: string, today: string): string {
  if (day === today) return 'Hoy'
  if (day === shiftDay(today, -1)) return 'Ayer'
  const [year, month, date] = day.split('-').map(Number)
  return new Intl.DateTimeFormat('es-CO', { weekday: 'long', day: 'numeric', month: 'long' }).format(new Date(year, month - 1, date))
}

export const observedText = (minutes: number) => minutes < 90 ? `${minutes} min` : `${Math.round(minutes / 60)} h`
