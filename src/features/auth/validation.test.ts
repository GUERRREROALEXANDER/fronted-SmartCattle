import { describe, expect, it } from 'vitest'
import { validateEmail, validateName, validatePassword } from './validation'
describe('auth validation', () => {
  it('requires an email and rejects malformed addresses', () => {
    for (const value of ['', '  ']) expect(validateEmail(value)).toBe('Escribe tu correo electrónico.')
    for (const value of ['ana', 'ana@finca', '@finca.com', 'a b@finca.com', 'a@@finca.com']) {
      expect(validateEmail(value)).toBe('Escribe un correo válido, por ejemplo nombre@finca.com.')
    }
    expect(validateEmail(' ana+campo@finca.com ')).toBeNull()
  })
  it('checks password boundaries without trimming passwords', () => {
    expect(validatePassword('')).toBe('Escribe tu contraseña.')
    expect(validatePassword('1234567')).toBe('Usa al menos 8 caracteres.')
    expect(validatePassword('12345678')).toBeNull()
    expect(validatePassword('1234567 ')).toBeNull()
    expect(validatePassword('12345678', { minLength: 10 })).toBe('Usa al menos 10 caracteres.')
    expect(validatePassword('1234567890', { minLength: 10 })).toBeNull()
  })
  it('requires two trimmed name characters', () => {
    for (const value of ['', ' ', ' A ']) expect(validateName(value)).toBe('Escribe tu nombre.')
    expect(validateName(' Ana ')).toBeNull()
    expect(validateName('Li')).toBeNull()
  })
})
