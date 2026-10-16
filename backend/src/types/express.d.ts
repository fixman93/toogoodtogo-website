import type { Role } from '../models/User.js'

declare global {
  namespace Express {
    interface Request {
      /** Set by the `authenticate` / `optionalAuth` middleware. */
      user?: { id: string; role: Role; staffOf: string[] }
    }
  }
}

export {}
