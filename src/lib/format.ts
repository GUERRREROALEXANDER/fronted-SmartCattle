// Spanish (Colombia) formatting helpers shared by every screen.
const locale = 'es-CO'

const timeFormat = new Intl.DateTimeFormat(locale, { hour: '2-digit', minute: '2-digit', hour12: false })
const dayFormat = new Intl.DateTimeFormat(locale, { weekday: 'short', day: 'numeric', month: 'short' })
const confidenceFormat = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 0 })
const countFormat = new Intl.NumberFormat(locale)
const relativeFormat = new Intl.RelativeTimeFormat(locale, { numeric: 'auto' })

export function formatTime(date: Date): string {
  return timeFormat.format(date)
}

export function formatDay(date: Date): string {
  return dayFormat.format(date)
}

export function formatConfidence(value: number): string {
  return confidenceFormat.format(value)
}

export function formatCount(value: number): string {
  return countFormat.format(value)
}

/** "hace 15 minutos", "hace 3 horas", "ayer". Future dates are treated as "ahora". */
export function formatRelative(date: Date, now: Date = new Date()): string {
  const seconds = Math.round((date.getTime() - now.getTime()) / 1000)
  if (seconds > -45) return 'ahora'
  const minutes = Math.round(seconds / 60)
  if (minutes > -60) return relativeFormat.format(minutes, 'minute')
  const hours = Math.round(minutes / 60)
  if (hours > -24) return relativeFormat.format(hours, 'hour')
  // Beyond a day, count calendar days so "ayer" always matches the day the event belongs to.
  const startOf = (value: Date) => new Date(value.getFullYear(), value.getMonth(), value.getDate()).getTime()
  const days = Math.round((startOf(date) - startOf(now)) / 86_400_000)
  return relativeFormat.format(days, 'day')
}
