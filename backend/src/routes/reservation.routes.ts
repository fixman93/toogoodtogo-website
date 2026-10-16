import { Router } from 'express'
import * as c from '../controllers/reservation.controller.js'
import { authenticate, requireRole } from '../middleware/auth.js'

export const reservationRoutes = Router()
/** Public pickup pass behind a "send to a friend" link (no sign-in). */
export const pickupRoutes = Router()
pickupRoutes.get('/:token', c.sharedPass)

reservationRoutes.use(authenticate)
reservationRoutes.get('/', c.listReservations)
reservationRoutes.get('/:id', c.getReservation)
reservationRoutes.post('/', c.createReservation)
// Scan / type a pickup code at the counter (business staff).
reservationRoutes.post('/collect', requireRole('business', 'staff', 'admin'), c.collectByCode)
reservationRoutes.patch('/:id/cancel', c.cancelReservation)
reservationRoutes.post('/:id/share', c.shareReservation)
reservationRoutes.patch('/:id/collect', requireRole('business', 'staff', 'admin'), c.collectReservation)
