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
// Check a code without handing over (scanner result screen).
reservationRoutes.post('/verify', requireRole('business', 'staff', 'admin'), c.verifyCode)
reservationRoutes.patch('/:id/cancel', c.cancelReservation)
reservationRoutes.post('/:id/share', c.shareReservation)
// Customer: "did you pick it up?" after an unclaimed reservation expired.
reservationRoutes.post('/:id/pickup-check', c.answerPickupCheck)
// Partner disputes a customer-confirmed pickup.
reservationRoutes.post('/:id/dispute', requireRole('business', 'admin'), c.openDispute)
reservationRoutes.patch('/:id/collect', requireRole('business', 'staff', 'admin'), c.collectReservation)
