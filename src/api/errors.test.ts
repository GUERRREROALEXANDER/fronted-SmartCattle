import { expect, it } from 'vitest'
import { ApiError, describeApiError } from './errors'

it.each([
  [new ApiError('network', ''), 'Sin conexión con el servidor', 'No se pudo contactar el backend. Comprueba que esté encendido y vuelve a intentarlo.'],
  [new ApiError('timeout', ''), 'El servidor tardó demasiado', 'La petición superó el tiempo de espera. Vuelve a intentarlo.'],
  [new ApiError('http', '', { status: 401 }), 'Acceso no autorizado', 'El servidor rechazó la petición.'],
  [new ApiError('http', '', { status: 403 }), 'Acceso no autorizado', 'El servidor rechazó la petición.'],
  [new ApiError('http', '', { status: 404 }), 'Recurso no encontrado', 'El servidor no ofrece este recurso. Puede que la versión del backend no coincida.'],
  [new ApiError('http', '', { status: 422 }), 'Petición no válida', 'El servidor no aceptó los datos de la petición.'],
  [new ApiError('http', '', { status: 500 }), 'Error del servidor', 'El backend respondió con un error interno (HTTP 500).'],
  [new ApiError('http', '', { status: 409 }), 'Error del servidor', 'El backend respondió con HTTP 409.'],
  [new ApiError('parse', ''), 'Respuesta inesperada del servidor', 'Los datos recibidos no tienen el formato esperado.'],
  [new Error('unexpected'), 'No se pudo cargar la información', 'Ocurrió un error inesperado.'],
] as const)('describes %s', (error, title, description) => {
  expect(describeApiError(error)).toEqual({ title, description })
})
