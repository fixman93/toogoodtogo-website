import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import type { Role } from '../models/User.js'
import { ApiError } from '../utils/ApiError.js'

interface TokenPayload {
  sub: string
  role: Role
}

export function signToken(userId: string, role: Role) {
  return jwt.sign({ role }, env.JWT_SECRET, { subject: userId, expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] })
}

function readUser(req: Request, strict: boolean): Request['user'] | null {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as TokenPayload
    return { id: payload.sub, role: payload.role }
  } catch {
    if (!strict) return null
    throw ApiError.unauthorized('Sesija je istekla. Prijavite se ponovo.', 'INVALID_TOKEN')
  }
}

/** Requires a valid bearer token. */
export function authenticate(req: Request, _res: Response, next: NextFunction) {
  const user = readUser(req, true)
  if (!user) throw ApiError.unauthorized()
  req.user = user
  next()
}

/** Attaches the user if a valid token is present; public routes ignore stale tokens. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  req.user = readUser(req, false) ?? undefined
  next()
}

/** Must run after `authenticate`. */
export function requireRole(...roles: Role[]) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !roles.includes(req.user.role)) throw ApiError.forbidden()
    next()
  }
}

/** Narrowing helper for controllers behind `authenticate`. */
export function currentUser(req: Request) {
  if (!req.user) throw ApiError.unauthorized()
  return req.user
}
