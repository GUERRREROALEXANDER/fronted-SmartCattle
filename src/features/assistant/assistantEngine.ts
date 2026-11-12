import type { AlertReport, DailyReport } from '../../types/domain'

/**
 * The assistant's rules. No language model: it recognises what is being asked, reads the farm's real
 * data and says it in a sentence, so it needs no key and cannot make up a number. What it has no data
 * for, it says so. It never turns posture counts into a diagnosis (PRODUCT.md: not veterinary software).
 */
export const ASSISTANT_NAME = 'Lucía'

export interface LiveFacts {
  /** Null while nothing has been counted. */
  cattleNow: number | null
  cameras: { name: string; online: boolean }[]
  openAlerts: number
}

export interface AssistantData {
  live: () => LiveFacts
  daily: (day: string) => Promise<DailyReport>
  alerts: (start: Date, end: Date) => Promise<AlertReport>
}

const normalize = (text: string) => text.toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim()
const has = (text: string, pattern: RegExp) => pattern.test(text)

/** The part of the name people go by: "Ana María Ruiz" is greeted as Ana. */
export function firstName(fullName: string | undefined | null): string | null {
  const first = fullName?.trim().split(/\s+/)[0]
  return first ? first : null
}

export function greeting(fullName: string | undefined | null): string {
  const name = firstName(fullName)
  return `¡Hola${name ? `, ${name}` : ''}! Soy ${ASSISTANT_NAME}, tu asistente de SmartCattle. Puedo contarte qué ha pasado con el ganado y ayudarte a conectar una cámara. ¿Qué necesitas?`
}

export const suggestions = ['¿Cómo está el ganado ahora?', '¿Qué pasó anoche?', '¿Qué ha pasado en las últimas semanas?', 'Mi cámara no conecta']

interface Period { label: string; days: number; offset: number }

/** The period asked about, counted in days ending `offset` days ago; null when none is named. */
export function periodOf(question: string): Period | null {
  const text = normalize(question)
  const weeks = text.match(/\b(\d+|dos|tres|cuatro)\s+semanas\b/)
  if (weeks) {
    const count = { dos: 2, tres: 3, cuatro: 4 }[weeks[1]!] ?? Number(weeks[1])
    const clamped = Math.min(Math.max(count, 1), 13)
    return { label: `las últimas ${clamped} semanas`, days: clamped * 7, offset: 0 }
  }
  const days = text.match(/\b(\d+)\s+dias\b/)
  if (days) {
    const count = Math.min(Math.max(Number(days[1]), 1), 92)
    return { label: `los últimos ${count} días`, days: count, offset: 0 }
  }
  if (has(text, /\bultim[oa]s? (mes|30)\b|\beste mes\b|\bel mes\b/)) return { label: 'el último mes', days: 30, offset: 0 }
  if (has(text, /\bultimas semanas\b|\bpasadas semanas\b/)) return { label: 'las últimas semanas', days: 21, offset: 0 }
  if (has(text, /\bsemana\b/)) return { label: 'la última semana', days: 7, offset: 0 }
  if (has(text, /\banteayer\b/)) return { label: 'anteayer', days: 1, offset: 2 }
  if (has(text, /\bayer\b/)) return { label: 'ayer', days: 1, offset: 1 }
  // The night that has just ended began yesterday: today's report starts at midnight and would miss half of it.
  if (has(text, /\banoche\b|\bla noche\b|\bmadrugada\b/)) return { label: 'anoche', days: 2, offset: 0 }
  if (has(text, /\bhoy\b/)) return { label: 'hoy', days: 1, offset: 0 }
  return null
}

const dayKey = (date: Date) => {
  const month = String(date.getMonth() + 1).padStart(2, '0')
  const day = String(date.getDate()).padStart(2, '0')
  return `${date.getFullYear()}-${month}-${day}`
}
const daysAgo = (now: Date, count: number) => new Date(now.getFullYear(), now.getMonth(), now.getDate() - count)
const plural = (count: number, one: string, many: string) => `${count} ${count === 1 ? one : many}`
const percent = (share: number) => `${Math.round(share * 100)} %`
const hours = (minutes: number) => minutes < 90 ? plural(minutes, 'minuto', 'minutos') : plural(Math.round(minutes / 60), 'hora', 'horas')

function alertSentence(report: Pick<AlertReport, 'days' | 'total'>): string {
  if (report.total === 0) return 'No se registraron alertas.'
  const critical = report.days.reduce((sum, day) => sum + day.critical, 0)
  const open = report.days.reduce((sum, day) => sum + day.open, 0)
  const parts = [`Hubo ${plural(report.total, 'alerta', 'alertas')}`]
  if (critical > 0) parts.push(`${plural(critical, 'crítica', 'críticas')}`)
  const opening = parts.join(', ')
  const worst = report.days.reduce((best, day) => day.total > best.total ? day : best)
  const busiest = report.days.filter(day => day.total > 0).length > 1 ? ` El día con más fue ${worst.day} (${worst.total}).` : ''
  const pending = open > 0 ? ` ${open === 1 ? 'Sigue 1 abierta' : `Siguen ${open} abiertas`}: revísalas en Eventos.` : ' Ya están todas atendidas.'
  return `${opening}.${busiest}${pending}`
}

function activitySentence(reports: DailyReport[]): string {
  const minutes = reports.reduce((sum, report) => sum + report.herd.observedMinutes, 0)
  if (minutes === 0) return 'Las cámaras no registraron actividad en ese tiempo, así que no puedo decirte cómo estuvo el ganado.'
  const peak = Math.max(...reports.map(report => report.herd.peakCattle))
  const lying = reports.reduce((sum, report) => sum + report.herd.lyingMinutes, 0)
  const standing = reports.reduce((sum, report) => sum + report.herd.standingMinutes, 0)
  const walking = reports.reduce((sum, report) => sum + report.herd.walkingMinutes, 0)
  const known = lying + standing + walking
  const posture = known > 0 ? ` Del tiempo con postura conocida, estuvo echado el ${percent(lying / known)}.` : ''
  return `Las cámaras observaron ${hours(minutes)}, con un máximo de ${plural(peak, 'animal', 'animales')} a la vista.${posture}`
}

function noticeSentence(reports: DailyReport[]): string {
  const notices = reports.flatMap(report => report.notices)
  if (notices.length === 0) return ''
  const long = notices.some(notice => notice.kind === 'prolonged_lying')
  return ` ${long ? 'El ganado pasó echado más tiempo de lo habitual' : 'El ganado se echó menos de lo habitual'} en alguna cámara: conviene ir a mirar. No es un diagnóstico; ante cualquier duda, consulta a un veterinario.`
}

function liveAnswer(facts: LiveFacts): string {
  const online = facts.cameras.filter(camera => camera.online).length
  if (facts.cameras.length === 0) return 'Aún no tienes cámaras conectadas, así que no sé cómo está el ganado. Dime «mi cámara no conecta» y te ayudo a agregar una.'
  const cattle = facts.cattleNow === null
    ? 'Todavía no hay un conteo reciente.'
    : `Ahora se detectan ${plural(facts.cattleNow, 'animal', 'animales')}.`
  const cameras = `${online} de ${plural(facts.cameras.length, 'cámara', 'cámaras')} en línea.`
  const alerts = facts.openAlerts === 0 ? 'No hay alertas abiertas.' : `Hay ${plural(facts.openAlerts, 'alerta abierta', 'alertas abiertas')}: revísalas en Eventos.`
  return `${cattle} ${cameras} ${alerts}`
}

async function periodAnswer(period: Period, data: AssistantData, now: Date): Promise<string> {
  // Up to a week of daily detail: past that, the alert report already covers the whole window in one request.
  const detail = Math.min(period.days, 7)
  const wanted = Array.from({ length: detail }, (_, index) => dayKey(daysAgo(now, period.offset + index)))
  const start = daysAgo(now, period.offset + period.days - 1)
  const end = period.offset === 0 ? now : daysAgo(now, period.offset - 1)
  const [reports, alerts] = await Promise.all([Promise.all(wanted.map(day => data.daily(day))), data.alerts(start, end)])
  const scope = period.days > detail ? ' (detalle de actividad de los últimos 7 días)' : ''
  return `Sobre ${period.label}${scope}: ${activitySentence(reports)} ${alertSentence(alerts)}${noticeSentence(reports)}`
}

function cameraAnswer(text: string, facts: LiveFacts): string {
  if (has(text, /celular|telefono|movil|webcam|transmitir/)) {
    return 'Para usar un celular como cámara: en esa página de Cámaras elige «Este celular o PC» y pulsa «Transmitir». No necesita IP ni contraseña, solo permiso para usar la cámara. Déjalo enchufado, con la página abierta y la pantalla encendida.'
  }
  if (has(text, /\bip\b|192\.168|direccion|rtsp|url|wifi/)) {
    return 'Una cámara con dirección 192.168.x.x solo se abre desde su mismo wifi. Tienes tres salidas: usar «Este celular o PC» para transmitir sin dirección, escribir una dirección pública, o dejar en la finca un PC encendido con internet y enlazarlo una vez.'
  }
  const down = facts.cameras.filter(camera => !camera.online).map(camera => camera.name)
  const which = down.length > 0 ? `Ahora ${down.length === 1 ? 'aparece sin conexión' : 'aparecen sin conexión'}: ${down.join(', ')}. ` : ''
  return `${which}Revisa en este orden: 1) que la cámara o el celular tenga energía e internet; 2) si es un celular, que siga con la página abierta y la pantalla encendida; 3) si es una cámara IP, que no use una dirección 192.168.x.x sin un PC enlazado en la finca; 4) pulsa «Conectar» de nuevo en la página de Cámaras. Si quieres, pregúntame por «celular» o por «dirección IP».`
}

/** The answer to one message. Failures to read the data are the caller's to word. */
export async function answer(question: string, data: AssistantData, now: Date, fullName?: string | null): Promise<string> {
  const text = normalize(question)
  if (text === '') return '¿En qué te ayudo?'
  const period = periodOf(question)
  // Before the cattle words: "la cámara del potrero no conecta" is about the camera.
  const cameraProblem = has(text, /camara|webcam|conect|\bip\b|rtsp|transmitir|sin imagen|no se ve|pantalla negra|celular|telefono/)
    && !has(text, /cuantas camaras|cuantas hay/)
  if (cameraProblem && period === null) return cameraAnswer(text, data.live())
  if (period !== null) return periodAnswer(period, data, now)
  if (has(text, /ganado|vaca|animal|bovino|hato|novedad|alerta|estado|como (va|esta|estan|sigue)|cuant[ao]s|ahora|resumen|informe|reporte|pasado|paso\b/)) {
    return liveAnswer(data.live())
  }
  if (has(text, /^(hola|buenas|buen dia|buenos dias|buenas tardes|buenas noches|hey|que tal)/)) return greeting(fullName)
  if (has(text, /gracias/)) return '¡Con gusto! Aquí estaré si necesitas algo más.'
  if (has(text, /quien eres|que puedes|que sabes|ayuda|como funcionas/)) {
    return `Soy ${ASSISTANT_NAME}. Respondo con los datos de tu finca: cómo está el ganado ahora, qué pasó hoy, ayer, anoche o en las últimas semanas, y cómo conectar una cámara. Soy un asistente de reglas, no una persona ni un veterinario.`
  }
  return 'No entendí esa pregunta. Prueba con «¿qué pasó anoche?», «¿cómo está el ganado?» o «mi cámara no conecta».'
}
