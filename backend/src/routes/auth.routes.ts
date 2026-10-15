import { Router } from 'express'
import rateLimit from 'express-rate-limit'
import * as c from '../controllers/auth.controller.js'
import { env } from '../config/env.js'
import { authenticate } from '../middleware/auth.js'

// Slow down credential stuffing / brute force.
const authLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: env.AUTH_RATE_LIMIT_MAX,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Previše pokušaja. Pokušajte ponovo za nekoliko minuta.' } },
})

export const authRoutes = Router()
authRoutes.post('/register', authLimiter, c.register)
authRoutes.post('/login', authLimiter, c.login)
authRoutes.get('/me', authenticate, c.me)
authRoutes.delete('/me', authLimiter, authenticate, c.deleteAccount)
