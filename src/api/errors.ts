export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'parse'

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number
  readonly detail?: string

  constructor(kind: ApiErrorKind, message: string, options: { status?: number; detail?: string } = {}) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = options.status
    this.detail = options.detail
  }
}
