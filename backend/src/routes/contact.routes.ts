import { Router, type Request, type Response } from 'express'
import rateLimit from 'express-rate-limit'
import { optionalAuth } from '../middleware/auth.js'
import { send } from '../services/contact.service.js'
import { ok } from '../utils/respond.js'
import { contactBody } from '../validators/contact.validators.js'

// Public form: a few messages per IP, then wait.
const contactLimiter = rateLimit({
  windowMs: 15 * 60_000,
  limit: 5,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { error: { code: 'RATE_LIMITED', message: 'Poslao/la si više poruka zaredom. Pokušaj ponovo za nekoliko minuta.' } },
})

export const contactRoutes = Router()
contactRoutes.post('/', contactLimiter, optionalAuth, async (req: Request, res: Response) => {
  const input = contactBody.parse(req.body)
  // Bots fill the hidden field: answer as if sent, send nothing.
  if (input.website) return ok(res, { sent: true })
  ok(res, await send(input, req.user?.id))
})
