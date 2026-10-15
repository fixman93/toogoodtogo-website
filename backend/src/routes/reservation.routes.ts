import { Router } from 'express'
import * as c from '../controllers/reservation.controller.js'
import { authenticate, requireRole } from '../middleware/auth.js'

export const reservationRoutes = Router()
reservationRoutes.use(authenticate)
reservationRoutes.get('/', c.listReservations)
reservationRoutes.get('/:id', c.getReservation)
reservationRoutes.post('/', c.createReservation)
// Scan / type a pickup code at the counter (business staff).
reservationRoutes.post('/collect', requireRole('business', 'admin'), c.collectByCode)
reservationRoutes.patch('/:id/cancel', c.cancelReservation)
reservationRoutes.patch('/:id/collect', requireRole('business', 'admin'), c.collectReservation)
