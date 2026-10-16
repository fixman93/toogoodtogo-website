import { Router } from 'express'
import * as c from '../controllers/support.controller.js'
import { authenticate } from '../middleware/auth.js'

/** Users see their own tickets; the support team (support.manage) can open any. */
export const supportRoutes = Router()
supportRoutes.use(authenticate)
supportRoutes.get('/', c.myTickets)
supportRoutes.post('/', c.createTicket)
supportRoutes.get('/:id', c.getTicket)
supportRoutes.post('/:id/messages', c.replyTicket)
supportRoutes.patch('/:id/close', c.closeTicket)
