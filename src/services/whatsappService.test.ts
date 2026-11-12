import { describe, expect, it, vi } from 'vitest'
import { ApiError } from '../api/errors'
import { confirmWhatsappCode, getWhatsappContact, removeWhatsappNumber, startWhatsappVerification, whatsappProblem } from './whatsappService'

const api = { mode: 'api' as const }
const answer = (body: unknown, status = 200) => vi.fn<typeof fetch>().mockResolvedValue(Response.json(body, { status }))

describe('the WhatsApp number on the server', () => {
  it('sends only the number to ask for a code', async () => {
    const fetchImpl = answer({ expires_in: 600 }, 202)
    await startWhatsappVerification('+573001234567', { ...api, fetchImpl })
    const [url, init] = fetchImpl.mock.calls[0]
    expect(String(url)).toContain('/api/auth/me/whatsapp/verification')
    expect(JSON.parse(String(init?.body))).toEqual({ phone: '+573001234567' })
  })

  it('reads the contact the code linked', async () => {
    const fetchImpl = answer({ user_id: 1, phone: '+573001234567', enabled: true, verified_at: '2026-11-04T00:00:00Z' })
    await expect(confirmWhatsappCode('123456', { ...api, fetchImpl })).resolves.toEqual({ phone: '+573001234567', enabled: true })
  })

  it('takes a 404 as no number yet, and any other failure as a failure', async () => {
    await expect(getWhatsappContact({ ...api, fetchImpl: answer({ detail: 'x' }, 404) })).resolves.toEqual({ source: 'api', data: null })
    await expect(getWhatsappContact({ ...api, fetchImpl: answer({ detail: 'x' }, 500) })).rejects.toBeInstanceOf(ApiError)
  })
})

describe('the demo', () => {
  it('links the number it was given, with any code, and forgets it when removed', async () => {
    const demo = { mode: 'mock' as const }
    await expect(confirmWhatsappCode('123456', demo)).rejects.toBeInstanceOf(ApiError)
    await startWhatsappVerification('+573001234567', demo)
    await expect(confirmWhatsappCode('123456', demo)).resolves.toMatchObject({ phone: '+573001234567' })
    await removeWhatsappNumber(demo)
    await expect(getWhatsappContact(demo)).resolves.toMatchObject({ data: null })
  })
})

describe('whatsappProblem', () => {
  it('never repeats what the server said', () => {
    const error = new ApiError('http', 'x', { status: 400, detail: 'secreto interno' })
    expect(whatsappProblem(error)).not.toContain('secreto')
    expect(whatsappProblem(error)).toMatch(/código/)
    expect(whatsappProblem(new ApiError('http', 'x', { status: 429 }))).toMatch(/Espera/)
    expect(whatsappProblem(new ApiError('network', 'x'))).toMatch(/conexión/)
  })
})
