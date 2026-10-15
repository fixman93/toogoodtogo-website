import { Router } from 'express'
import * as c from '../controllers/business.controller.js'
import { authenticate, optionalAuth, requireRole } from '../middleware/auth.js'

export const businessRoutes = Router()
businessRoutes.get('/', optionalAuth, c.listBusinesses)
businessRoutes.get('/:id', optionalAuth, c.getBusiness)
businessRoutes.post('/', authenticate, requireRole('business', 'admin'), c.createBusiness)
// Ownership is enforced in the service (owner or admin only).
businessRoutes.patch('/:id', authenticate, requireRole('business', 'admin'), c.updateBusiness)
// Partner view: all of a location's offers incl. paused/past (owner or admin).
businessRoutes.get('/:id/offers', authenticate, requireRole('business', 'admin'), c.listBusinessOffers)
businessRoutes.get('/:id/reviews', c.listReviews)
businessRoutes.post('/:id/reviews', authenticate, c.createReview)
