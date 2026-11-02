import { Router } from 'express'
import * as c from '../controllers/reward.controller.js'
import { authenticate } from '../middleware/auth.js'

export const rewardRoutes = Router()
rewardRoutes.use(authenticate)
rewardRoutes.get('/', c.getCatalog)
rewardRoutes.get('/redemptions', c.getMyRedemptions)
rewardRoutes.post('/:id/redeem', c.redeem)
