import type { NextFunction, Request, Response } from 'express'
import mongoose from 'mongoose'
import { ZodError } from 'zod'
import { isProduction } from '../config/env.js'
import { ApiError } from '../utils/ApiError.js'

export function notFoundHandler(req: Request, _res: Response, next: NextFunction) {
  next(ApiError.notFound(`Ruta ${req.method} ${req.originalUrl} ne postoji.`, 'ROUTE_NOT_FOUND'))
}

/** Converts every thrown error into the `{ error: { code, message, details } }` envelope. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction) {
  let error: ApiError

  if (err instanceof ApiError) {
    error = err
  } else if (err instanceof ZodError) {
    error = ApiError.badRequest(
      'Neispravni podaci u zahtevu.',
      'VALIDATION_ERROR',
      err.issues.map((i) => ({ path: i.path.join('.'), message: i.message })),
    )
  } else if (err instanceof mongoose.Error.ValidationError) {
    error = ApiError.badRequest(
      'Neispravni podaci.',
      'VALIDATION_ERROR',
      Object.values(err.errors).map((e) => ({ path: e.path, message: e.message })),
    )
  } else if (err instanceof mongoose.Error.CastError) {
    error = ApiError.badRequest(`Neispravna vrednost za ${err.path}.`, 'INVALID_ID')
  } else if (typeof err === 'object' && err && 'code' in err && (err as { code: unknown }).code === 11000) {
    error = ApiError.conflict('Zapis već postoji.', 'DUPLICATE')
  } else if (err instanceof SyntaxError && 'body' in err) {
    error = ApiError.badRequest('Neispravan JSON.', 'INVALID_JSON')
  } else {
    console.error(err)
    error = new ApiError(500, 'INTERNAL_ERROR', 'Došlo je do greške na serveru.', isProduction ? undefined : String(err))
  }

  res.status(error.status).json({ error: { code: error.code, message: error.message, details: error.details } })
}
