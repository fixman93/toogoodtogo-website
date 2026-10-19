import { Router } from 'express'
import * as c from '../controllers/schedule.controller.js'
import { authenticate, requireRole } from '../middleware/auth.js'

/** Repeating offers and the "how many bags" suggestion (owner or admin; checked in the service). */
export const scheduleRoutes = Router()
scheduleRoutes.use(authenticate, requireRole('business', 'admin'))
scheduleRoutes.get('/', c.listSchedules)
scheduleRoutes.get('/recommendation', c.recommendation)
scheduleRoutes.post('/', c.createSchedule)
scheduleRoutes.patch('/:id', c.updateSchedule)
scheduleRoutes.delete('/:id', c.deleteSchedule)
