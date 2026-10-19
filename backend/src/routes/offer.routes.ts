import { Router } from 'express'
import * as c from '../controllers/offer.controller.js'
import { authenticate, requireRole } from '../middleware/auth.js'

export const offerRoutes = Router()
offerRoutes.get('/', c.listOffers)
// Must be declared before '/:id'.
offerRoutes.get('/locations', c.listOfferLocations)
offerRoutes.get('/:id', c.getOffer)
// Ownership of the offer's business is enforced in the service.
offerRoutes.post('/', authenticate, requireRole('business', 'admin'), c.createOffer)
offerRoutes.patch('/:id', authenticate, requireRole('business', 'admin'), c.updateOffer)
offerRoutes.delete('/:id', authenticate, requireRole('business', 'admin'), c.deleteOffer)
// Paid promotion ("Istakni"): prices + buy; charged on the monthly statement.
offerRoutes.get('/:id/boost', authenticate, requireRole('business', 'admin'), c.boostOptions)
offerRoutes.post('/:id/boost', authenticate, requireRole('business', 'admin'), c.buyBoost)
