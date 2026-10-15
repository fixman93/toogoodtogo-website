import { Router } from 'express'
import * as c from '../controllers/partner.controller.js'
import { authenticate, requireRole } from '../middleware/auth.js'

/** Partner portal endpoints scoped to the signed-in partner's own locations. */
export const partnerRoutes = Router()
partnerRoutes.get('/sales', authenticate, requireRole('business', 'admin'), c.getSales)
partnerRoutes.get('/orders', authenticate, requireRole('business', 'admin'), c.listOrders)

/** "Postani partner" — any signed-in user can apply; admins decide in /admin. */
export const applicationRoutes = Router()
applicationRoutes.use(authenticate)
applicationRoutes.post('/', c.applyAsPartner)
applicationRoutes.get('/me', c.myApplication)
