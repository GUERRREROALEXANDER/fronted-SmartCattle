const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
const usernamePattern = /^[a-z0-9._-]{3,20}$/
const identifierPattern = /^[a-zA-Z0-9._-]{3,20}$/

export interface PasswordStrength {
  score: number
  label: string
  checks: readonly { id: 'length' | 'uppercase' | 'lowercase' | 'number' | 'symbol'; label: string; met: boolean }[]
}

export function validateEmail(value: string): string | null {
  if (!value.trim()) return 'Escribe tu correo electrónico.'
  return emailPattern.test(value.trim()) ? null : 'Escribe un correo válido, por ejemplo nombre@finca.com.'
}

export function validateUsername(value: string): string | null {
  const username = value.trim()
  if (!username) return 'Escribe tu nombre de usuario.'
  if (username.length < 3 || username.length > 20) return 'Usa entre 3 y 20 caracteres.'
  return usernamePattern.test(username) ? null : 'Usa solo minúsculas, números, puntos, guiones o guion bajo.'
}

export function validateIdentifier(value: string): string | null {
  const identifier = value.trim()
  if (!identifier) return 'Escribe tu usuario o correo electrónico.'
  if (identifier.includes('@')) {
    return emailPattern.test(identifier) ? null : 'Escribe un correo válido o entra con tu usuario.'
  }
  return identifierPattern.test(identifier) ? null : 'Escribe un usuario válido o tu correo electrónico.'
}

export function validatePassword(value: string, { minLength = 8 }: { minLength?: number } = {}): string | null {
  if (!value) return 'Escribe tu contraseña.'
  return value.length < minLength ? `Usa al menos ${minLength} caracteres.` : null
}

export function getPasswordStrength(value: string): PasswordStrength {
  const checks = [
    { id: 'length', label: '8 caracteres o más', met: value.length >= 8 },
    { id: 'uppercase', label: 'Una mayúscula', met: /[A-ZÁÉÍÓÚÜÑ]/.test(value) },
    { id: 'lowercase', label: 'Una minúscula', met: /[a-záéíóúüñ]/.test(value) },
    { id: 'number', label: 'Un número', met: /\d/.test(value) },
    { id: 'symbol', label: 'Un símbolo', met: /[^A-Za-zÁÉÍÓÚÜÑáéíóúüñ\d\s]/.test(value) },
  ] as const
  const score = checks.filter(check => check.met).length
  // Registration requires all five checks, so only a full score is called strong.
  const labels = ['Muy débil', 'Muy débil', 'Débil', 'Media', 'Casi lista', 'Fuerte'] as const
  return { score, label: labels[score], checks }
}

export function validateNewPassword(value: string): string | null {
  const required = validatePassword(value)
  if (required) return required
  const missing = getPasswordStrength(value).checks.find(check => !check.met)
  if (!missing) return null
  const messages = {
    length: 'Usa al menos 8 caracteres.',
    uppercase: 'Añade al menos una letra mayúscula.',
    lowercase: 'Añade al menos una letra minúscula.',
    number: 'Añade al menos un número.',
    symbol: 'Añade al menos un símbolo, como ! o #.',
  } as const
  return messages[missing.id]
}

export function validatePasswordConfirmation(password: string, confirmation: string): string | null {
  if (!confirmation) return 'Confirma tu contraseña.'
  return confirmation === password ? null : 'Las contraseñas no coinciden.'
}
