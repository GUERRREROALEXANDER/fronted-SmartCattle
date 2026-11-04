import { describe, expect, it, vi } from 'vitest'
import type { AlertReport, DailyReport } from '../../types/domain'
import { answer, firstName, greeting, periodOf, type AssistantData, type LiveFacts } from './assistantEngine'

const NOW = new Date(2026, 10, 3, 15, 0)

function day(overrides: Partial<DailyReport['herd']> = {}, notices: DailyReport['notices'] = []): DailyReport {
  return {
    day: '2026-11-03', complete: false, eventsTotal: 0, notices,
    alerts: { total: 0, info: 0, warning: 0, critical: 0, open: 0, acknowledged: 0, resolved: 0 },
    herd: { observedMinutes: 0, lyingMinutes: 0, standingMinutes: 0, walkingMinutes: 0, peakCattle: 0, peakPeople: 0, minutesWithPeople: 0, lyingShare: null, ...overrides },
  }
}

const quiet: AlertReport = { days: [], total: 0, avgMinutesToAcknowledge: null, avgMinutesToResolve: null }
const facts: LiveFacts = { cattleNow: 12, cameras: [{ name: 'Norte', online: true }, { name: 'Sur', online: false }], openAlerts: 1 }

function data(overrides: Partial<AssistantData> = {}): AssistantData {
  return { live: () => facts, daily: async () => day(), alerts: async () => quiet, ...overrides }
}

describe('greeting', () => {
  it('greets by first name', () => {
    expect(greeting('Ana María Ruiz')).toContain('Hola, Ana!')
    expect(firstName('  Diego ')).toBe('Diego')
  })

  it('still greets someone with no name', () => {
    expect(greeting(null)).toContain('¡Hola!')
    expect(firstName('')).toBeNull()
  })
})

describe('periodOf', () => {
  it.each([
    ['¿Qué pasó hoy?', 'hoy', 1, 0],
    ['y AYER?', 'ayer', 1, 1],
    ['¿qué pasó anteayer?', 'anteayer', 1, 2],
    ['¿Qué pasó anoche?', 'anoche', 2, 0],
    ['en la madrugada', 'anoche', 2, 0],
    ['esta semana', 'la última semana', 7, 0],
    ['¿Qué ha pasado con el ganado en las últimas semanas?', 'las últimas semanas', 21, 0],
    ['últimas 2 semanas', 'las últimas 2 semanas', 14, 0],
    ['hace tres semanas', 'las últimas 3 semanas', 21, 0],
    ['el último mes', 'el último mes', 30, 0],
    ['los últimos 10 días', 'los últimos 10 días', 10, 0],
  ])('reads %s', (question, label, days, offset) => {
    expect(periodOf(question)).toEqual({ label, days, offset })
  })

  it('finds none when no time is named', () => {
    expect(periodOf('¿cómo está el ganado?')).toBeNull()
  })

  it('does not ask for more than the server keeps in one report', () => {
    expect(periodOf('últimos 500 días')?.days).toBe(92)
    expect(periodOf('últimas 90 semanas')?.days).toBe(91)
  })
})

describe('answer', () => {
  it('answers the question of the brief from real alerts and activity', async () => {
    const alerts = vi.fn(async (): Promise<AlertReport> => ({
      total: 5, avgMinutesToAcknowledge: null, avgMinutesToResolve: null,
      days: [
        { day: '2026-10-20', total: 4, info: 0, warning: 2, critical: 2, open: 0, acknowledged: 0, resolved: 4 },
        { day: '2026-11-01', total: 1, info: 1, warning: 0, critical: 0, open: 1, acknowledged: 0, resolved: 0 },
      ],
    }))
    const reply = await answer('¿Qué ha pasado con el ganado en las últimas semanas?', data({
      alerts, daily: async () => day({ observedMinutes: 600, peakCattle: 9, lyingMinutes: 300, standingMinutes: 200, walkingMinutes: 100 }),
    }), NOW)
    expect(reply).toContain('las últimas semanas')
    expect(reply).toContain('Hubo 5 alertas, 2 críticas')
    expect(reply).toContain('El día con más fue 2026-10-20 (4)')
    expect(reply).toContain('Sigue 1 abierta')
    expect(reply).toContain('máximo de 9 animales')
    expect(reply).toContain('echado el 50 %')
    expect(alerts).toHaveBeenCalledWith(new Date(2026, 9, 14), NOW)
  })

  it('reads only a week of days, however long the period, so a question costs few requests', async () => {
    const daily = vi.fn(async () => day())
    await answer('último mes', data({ daily }), NOW)
    expect(daily).toHaveBeenCalledTimes(7)
  })

  it('asks for the real calendar days, across the month', async () => {
    const daily = vi.fn(async () => day())
    await answer('ayer', data({ daily }), new Date(2026, 10, 1, 8))
    expect(daily).toHaveBeenCalledWith('2026-10-31')
  })

  it('covers both days of a night', async () => {
    const daily = vi.fn(async () => day())
    await answer('¿qué pasó anoche?', data({ daily }), NOW)
    expect(daily.mock.calls).toEqual([['2026-11-03'], ['2026-11-02']])
  })

  it('says it does not know when no camera watched, rather than that all was well', async () => {
    const reply = await answer('qué pasó ayer', data(), NOW)
    expect(reply).toContain('no puedo decirte cómo estuvo el ganado')
  })

  it('mentions a notice without calling it a diagnosis', async () => {
    const reply = await answer('hoy', data({
      daily: async () => day({ observedMinutes: 300, lyingMinutes: 290, standingMinutes: 10 }, [{ cameraId: 'a', kind: 'prolonged_lying', lyingShare: 0.97 }]),
    }), NOW)
    expect(reply).toContain('más tiempo de lo habitual')
    expect(reply).toContain('No es un diagnóstico')
  })

  it('tells the state right now from the live data', async () => {
    const reply = await answer('¿Cómo está el ganado?', data(), NOW)
    expect(reply).toBe('Ahora se detectan 12 animales. 1 de 2 cámaras en línea. Hay 1 alerta abierta: revísalas en Eventos.')
  })

  it('does not invent a count before there is one', async () => {
    const reply = await answer('cómo va el ganado', data({ live: () => ({ ...facts, cattleNow: null }) }), NOW)
    expect(reply).toContain('Todavía no hay un conteo')
  })

  it('points to adding a camera when there is none', async () => {
    const reply = await answer('cómo está el ganado', data({ live: () => ({ cattleNow: null, cameras: [], openAlerts: 0 }) }), NOW)
    expect(reply).toContain('no tienes cámaras')
  })

  it.each([
    ['mi cámara no conecta', 'Sur'],
    ['no se ve la imagen', 'Revisa en este orden'],
    ['quiero usar el celular', 'Este celular o PC'],
    ['tengo una camara con ip 192.168.1.20', 'mismo wifi'],
    ['la camara del potrero con rtsp', 'mismo wifi'],
  ])('helps with the camera problem in "%s"', async (question, expected) => {
    expect(await answer(question, data(), NOW)).toContain(expected)
  })

  it('understands without accents or capitals', async () => {
    expect(await answer('COMO ESTA EL GANADO', data(), NOW)).toContain('12 animales')
  })

  it('says what it is when asked, and admits what it did not understand', async () => {
    expect(await answer('¿quién eres?', data(), NOW)).toContain('no una persona ni un veterinario')
    expect(await answer('cuéntame un chiste', data(), NOW)).toContain('No entendí')
  })

  it('greets by name when greeted', async () => {
    expect(await answer('hola', data(), NOW, 'Diego Guerrero')).toContain('Hola, Diego')
  })
})
