import { Router } from 'express'
import * as c from '../controllers/push.controller.js'
import { authenticate } from '../middleware/auth.js'

export const pushRoutes = Router()
pushRoutes.get('/key', c.publicKey)
pushRoutes.post('/subscriptions', authenticate, c.subscribe)
pushRoutes.delete('/subscriptions', authenticate, c.unsubscribe)
