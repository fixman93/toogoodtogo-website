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
authRoutes.get('/me/impact', authenticate, c.myImpact)
// "Preuzmi moje podatke" (GDPR: access + portability). Rate-limited like other account actions.
authRoutes.get('/me/export', authLimiter, authenticate, c.exportMyData)
authRoutes.post('/forgot-password', authLimiter, c.forgotPassword)
authRoutes.post('/reset-password', authLimiter, c.resetPassword)
authRoutes.delete('/me', authLimiter, authenticate, c.deleteAccount)
authRoutes.patch('/me/preferences', authenticate, c.updatePreferences)
authRoutes.patch('/me', authenticate, c.updateProfile)
// Accept the current terms / partner rules (stored with version and time).
authRoutes.post('/me/legal', authenticate, c.acceptLegal)
