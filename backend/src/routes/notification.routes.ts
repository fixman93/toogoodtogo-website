import { Router } from 'express'
import * as c from '../controllers/notification.controller.js'
import { authenticate } from '../middleware/auth.js'

export const notificationRoutes = Router()
notificationRoutes.use(authenticate)
notificationRoutes.get('/', c.listNotifications)
notificationRoutes.get('/unread-count', c.unreadCount)
notificationRoutes.post('/read-all', c.markAllRead)
notificationRoutes.patch('/:id/read', c.markRead)

/** "Obavesti me kad bude dostupno" — keyed by offer id. */
export const waitlistRoutes = Router()
waitlistRoutes.use(authenticate)
waitlistRoutes.get('/', c.myWaitlist)
waitlistRoutes.put('/:id', c.joinWaitlist)
waitlistRoutes.delete('/:id', c.leaveWaitlist)
