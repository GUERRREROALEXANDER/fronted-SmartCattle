import { describe, expect, it } from 'vitest'
import {
  getPasswordStrength, validateEmail, validateIdentifier, validateNewPassword, validatePassword,
  validatePasswordConfirmation, validateUsername,
} from './validation'

describe('auth validation', () => {
  it('requires an email and rejects malformed addresses', () => {
    for (const value of ['', '  ']) expect(validateEmail(value)).toBe('Escribe tu correo electrónico.')
    for (const value of ['ana', 'ana@finca', '@finca.com', 'a b@finca.com', 'a@@finca.com']) {
      expect(validateEmail(value)).toBe('Escribe un correo válido, por ejemplo nombre@finca.com.')
    }
    expect(validateEmail(' ana+campo@finca.com ')).toBeNull()
  })

  it('validates lowercase usernames and their length boundaries', () => {
    expect(validateUsername('')).toBe('Escribe tu nombre de usuario.')
    for (const value of ['ab', 'a'.repeat(21)]) expect(validateUsername(value)).toBe('Usa entre 3 y 20 caracteres.')
    for (const value of ['Ana', 'ana maria', 'ána', 'ana!']) {
      expect(validateUsername(value)).toBe('Usa solo minúsculas, números, puntos, guiones o guion bajo.')
    }
    for (const value of ['abc', 'ana.ruiz-01_x', 'a'.repeat(20), ' ana ']) expect(validateUsername(value)).toBeNull()
  })

  it('accepts either a username or an email as a case-insensitive login identifier', () => {
    expect(validateIdentifier('')).toBe('Escribe tu usuario o correo electrónico.')
    expect(validateIdentifier('Carmen.Rojas')).toBeNull()
    expect(validateIdentifier('DUENO@SANJOSE.DEMO')).toBeNull()
    expect(validateIdentifier('ab')).toBe('Escribe un usuario válido o tu correo electrónico.')
    expect(validateIdentifier('correo@invalido')).toBe('Escribe un correo válido o entra con tu usuario.')
  })

  it('checks login password boundaries without trimming passwords', () => {
    expect(validatePassword('')).toBe('Escribe tu contraseña.')
    expect(validatePassword('1234567')).toBe('Usa al menos 8 caracteres.')
    expect(validatePassword('12345678')).toBeNull()
    expect(validatePassword('1234567 ')).toBeNull()
    expect(validatePassword('12345678', { minLength: 10 })).toBe('Usa al menos 10 caracteres.')
    expect(validatePassword('1234567890', { minLength: 10 })).toBeNull()
  })

  it('scores every password strength requirement', () => {
    expect(getPasswordStrength('').score).toBe(0)
    expect(getPasswordStrength('abcdefgh')).toMatchObject({ score: 2, label: 'Débil' })
    expect(getPasswordStrength('Abcdefg1')).toMatchObject({ score: 4, label: 'Casi lista' })
    const strong = getPasswordStrength('Abcdef1!')
    expect(strong).toMatchObject({ score: 5, label: 'Fuerte' })
    expect(strong.checks.every(check => check.met)).toBe(true)
  })

  it('requires all strength criteria for a new password', () => {
    expect(validateNewPassword('')).toBe('Escribe tu contraseña.')
    expect(validateNewPassword('Abc1!')).toBe('Usa al menos 8 caracteres.')
    expect(validateNewPassword('abcdefgh')).toBe('Añade al menos una letra mayúscula.')
    expect(validateNewPassword('ABCDEFGH')).toBe('Añade al menos una letra minúscula.')
    expect(validateNewPassword('Abcdefgh')).toBe('Añade al menos un número.')
    expect(validateNewPassword('Abcdefg1')).toBe('Añade al menos un símbolo, como ! o #.')
    expect(validateNewPassword('Abcdef1!')).toBeNull()
  })

  it('requires a matching password confirmation', () => {
    expect(validatePasswordConfirmation('Abcdef1!', '')).toBe('Confirma tu contraseña.')
    expect(validatePasswordConfirmation('Abcdef1!', 'Abcdef1?')).toBe('Las contraseñas no coinciden.')
    expect(validatePasswordConfirmation('Abcdef1!', 'Abcdef1!')).toBeNull()
  })
})
