import type { NextFunction, Request, Response } from 'express'
import jwt from 'jsonwebtoken'
import { env } from '../config/env.js'
import { can, type Permission } from '../config/permissions.js'
import { User, type Role } from '../models/User.js'
import { userForApiKey } from '../services/integration.service.js'
import { ApiError } from '../utils/ApiError.js'

interface TokenPayload {
  sub: string
  role: Role
  iat?: number
}

/**
 * Sliding session: a token older than this is replaced on the next request
 * (header `X-Session-Token`), so someone who uses the app stays signed in and
 * only an unused device is signed out after JWT_EXPIRES_IN.
 */
const RENEW_AFTER_SECONDS = 24 * 3600
export const SESSION_TOKEN_HEADER = 'X-Session-Token'

export function signToken(userId: string, role: Role) {
  return jwt.sign({ role }, env.JWT_SECRET, { subject: userId, expiresIn: env.JWT_EXPIRES_IN as jwt.SignOptions['expiresIn'] })
}

function readUser(req: Request, strict: boolean): (Request['user'] & { iat?: number }) | null {
  const header = req.headers.authorization
  if (!header?.startsWith('Bearer ')) return null
  try {
    const payload = jwt.verify(header.slice(7), env.JWT_SECRET) as TokenPayload
    return { id: payload.sub, role: payload.role, staffOf: [], iat: payload.iat }
  } catch {
    if (!strict) return null
    throw ApiError.unauthorized('Sesija je istekla. Prijavite se ponovo.', 'INVALID_TOKEN')
  }
}

/**
 * Requires a valid bearer token. The role is read from the database (not the
 * token), so role changes and deleted accounts take effect immediately.
 */
export async function authenticate(req: Request, res: Response, next: NextFunction) {
  const apiKey = req.get('x-api-key')
  if (apiKey) {
    // Integration keys act as the partner, but never on account/admin endpoints.
    if (/^\/api\/(auth|admin|push|support|partner\/api-keys|partner\/webhooks)/.test(req.originalUrl)) throw ApiError.forbidden('API ključ ne važi za ovu rutu.', 'API_KEY_NOT_ALLOWED')
    const user = await userForApiKey(apiKey)
    if (!user) throw ApiError.unauthorized('Neispravan API ključ.', 'INVALID_API_KEY')
    req.user = user as Request['user']
    return next()
  }
  const token = readUser(req, true)
  if (!token) throw ApiError.unauthorized()
  const user = await User.findById(token.id).select('role isBlocked deletedAt staffOf passwordChangedAt').lean()
  if (!user || user.deletedAt) throw ApiError.unauthorized('Nalog više ne postoji.', 'USER_NOT_FOUND')
  // Tokens issued before a password change are no longer valid (all devices signed out).
  if (user.passwordChangedAt && token.iat && token.iat * 1000 < user.passwordChangedAt.getTime() - 1000) {
    throw ApiError.unauthorized('Lozinka je promenjena. Prijavi se ponovo.', 'SESSION_EXPIRED')
  }
  if (user.isBlocked) throw ApiError.forbidden('Nalog je blokiran. Kontaktiraj podršku.', 'ACCOUNT_BLOCKED')
  req.user = { id: token.id, role: user.role, staffOf: (user.staffOf ?? []).map(String) }
  if (token.iat && Date.now() / 1000 - token.iat > RENEW_AFTER_SECONDS) res.setHeader(SESSION_TOKEN_HEADER, signToken(token.id, user.role))
  next()
}

/** Attaches the user if a valid token is present; public routes ignore stale tokens. */
export function optionalAuth(req: Request, _res: Response, next: NextFunction) {
  req.user = readUser(req, false) ?? undefined
  next()
}

/** Must run after `authenticate`. Platform permission check (see config/permissions). */
export function requirePermission(permission: Permission) {
  return (req: Request, _res: Response, next: NextFunction) => {
    if (!req.user || !can(req.user.role, permission)) throw ApiError.forbidden()
    next()
  }
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
