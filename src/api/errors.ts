export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'parse'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number
  readonly detail?: string
  readonly retryAfterMs?: number

  constructor(kind: ApiErrorKind, message: string, options: { status?: number; detail?: string; retryAfterMs?: number } = {}) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = options.status
    this.detail = options.detail
    this.retryAfterMs = options.retryAfterMs
  }
}

export function describeApiError(error: unknown): { title: string; description: string } {
  if (error instanceof ApiError) {
    if (error.kind === 'network') return { title: 'Sin conexión con el servidor', description: 'No se pudo contactar el backend. Comprueba que esté encendido y vuelve a intentarlo.' }
    if (error.kind === 'timeout') return { title: 'El servidor tardó demasiado', description: 'La petición superó el tiempo de espera. Vuelve a intentarlo.' }
    if (error.kind === 'parse') return { title: 'Respuesta inesperada del servidor', description: 'Los datos recibidos no tienen el formato esperado.' }
    if (error.status === 401) return { title: 'Sesión vencida', description: 'Vuelve a iniciar sesión para seguir viendo la información de la finca.' }
    if (error.status === 403) return { title: 'Sin permiso', description: 'Tu rol no permite esta acción. Pídesela al propietario de la finca.' }
    if (error.status === 409) return { title: 'Ya no se puede hacer', description: error.detail ?? 'El estado cambió mientras tanto. Recarga y vuelve a intentarlo.' }
    if (error.status === 503) return { title: 'Servicio sin configurar', description: 'El backend todavía no tiene activa esta función.' }
    if (error.status === 404) return { title: 'Recurso no encontrado', description: 'El servidor no ofrece este recurso. Puede que la versión del backend no coincida.' }
    if (error.status === 422) return { title: 'Petición no válida', description: 'El servidor no aceptó los datos de la petición.' }
    if (error.status !== undefined && error.status >= 500) return { title: 'Error del servidor', description: `El backend respondió con un error interno (HTTP ${error.status}).` }
    return { title: 'Error del servidor', description: `El backend respondió con HTTP ${error.status}.` }
  }
  return { title: 'No se pudo cargar la información', description: 'Ocurrió un error inesperado.' }
}
