export function validateEmail(value: string): string | null {
  if (!value.trim()) return 'Escribe tu correo electrónico.'
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim())
    ? null : 'Escribe un correo válido, por ejemplo nombre@finca.com.'
}
export function validatePassword(value: string, { minLength = 8 }: { minLength?: number } = {}): string | null {
  if (!value) return 'Escribe tu contraseña.'
  return value.length < minLength ? `Usa al menos ${minLength} caracteres.` : null
}
export function validateName(value: string): string | null {
  return value.trim().length < 2 ? 'Escribe tu nombre.' : null
}
