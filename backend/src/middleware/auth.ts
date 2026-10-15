import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { User, type Role } from '../models/User.js'
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

/**
 * Requires a valid bearer token. The role is read from the database (not the
 * token), so role changes and deleted accounts take effect immediately.
 */
export async function authenticate(req: Request, _res: Response, next: NextFunction) {
  const token = readUser(req, true)
  if (!token) throw ApiError.unauthorized()
  const user = await User.findById(token.id).select('role isBlocked deletedAt').lean()
  if (!user || user.deletedAt) throw ApiError.unauthorized('Nalog više ne postoji.', 'USER_NOT_FOUND')
  if (user.isBlocked) throw ApiError.forbidden('Nalog je blokiran. Kontaktiraj podršku.', 'ACCOUNT_BLOCKED')
  req.user = { id: token.id, role: user.role }
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
