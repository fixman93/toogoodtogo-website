/** Operational error with an HTTP status and a stable machine-readable code. */
export class ApiError extends Error {
  readonly status: number
  readonly code: string
  readonly details?: unknown

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message)
    this.status = status
    this.code = code
    this.details = details
  }

  static badRequest(message: string, code = 'BAD_REQUEST', details?: unknown) {
    return new ApiError(400, code, message, details)
  }
  static unauthorized(message = 'Potrebna je prijava.', code = 'UNAUTHORIZED') {
    return new ApiError(401, code, message)
  }
  static forbidden(message = 'Nemate dozvolu za ovu radnju.', code = 'FORBIDDEN') {
    return new ApiError(403, code, message)
  }
  static notFound(message = 'Resurs nije pronađen.', code = 'NOT_FOUND') {
    return new ApiError(404, code, message)
  }
  static conflict(message: string, code = 'CONFLICT') {
    return new ApiError(409, code, message)
  }
}
