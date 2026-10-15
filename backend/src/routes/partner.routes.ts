import { Router } from 'express'
import * as c from '../controllers/partner.controller.js'
import { authenticate, requireRole } from '../middleware/auth.js'

/** Partner portal endpoints scoped to the signed-in partner's own locations. */
export const partnerRoutes = Router()
partnerRoutes.use(authenticate, requireRole('business', 'admin'))
partnerRoutes.get('/sales', c.getSales)
