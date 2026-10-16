import { Router } from 'express'
import * as c from '../controllers/promotion.controller.js'
import { authenticate } from '../middleware/auth.js'

/** Partners manage their codes; promotions.manage manages platform codes (checked in the service). */
export const promotionRoutes = Router()
promotionRoutes.use(authenticate)
promotionRoutes.post('/check', c.checkPromotion)
promotionRoutes.get('/', c.listPromotions)
promotionRoutes.post('/', c.createPromotion)
promotionRoutes.patch('/:id', c.updatePromotion)
