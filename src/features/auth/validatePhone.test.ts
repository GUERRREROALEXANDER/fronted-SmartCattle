import { describe, expect, it } from 'vitest'
import { normalizePhone, validatePhone } from './validation'

describe('the WhatsApp number', () => {
  it('accepts +57 and ten digits, however it was spaced', () => {
    expect(validatePhone('+573001234567')).toBeNull()
    expect(validatePhone(' +57 300 123-4567 ')).toBeNull()
    expect(normalizePhone('+57 (300) 123-4567')).toBe('+573001234567')
  })

  it('asks for it when it is empty', () => {
    expect(validatePhone('   ')).toMatch(/Escribe/)
  })

  it('refuses any other prefix, or none', () => {
    for (const phone of ['3001234567', '573001234567', '+13001234567', '+58 3001234567']) {
      expect(validatePhone(phone)).toMatch(/\+57/)
    }
  })

  it('refuses the wrong number of digits or anything that is not a digit', () => {
    for (const phone of ['+57300123456', '+5730012345678', '+57300123456a']) {
      expect(validatePhone(phone)).toMatch(/10 dígitos/)
    }
  })
})
