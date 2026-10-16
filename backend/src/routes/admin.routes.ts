import { Router } from 'express'
import * as c from '../controllers/admin.controller.js'
import { adminTickets } from '../controllers/support.controller.js'
import { authenticate, requirePermission } from '../middleware/auth.js'

/** Platform administration — each route requires its own permission (config/permissions). */
export const adminRoutes = Router()
adminRoutes.use(authenticate)
adminRoutes.get('/stats', requirePermission('stats.view'), c.getStats)
adminRoutes.get('/users', requirePermission('users.view'), c.listUsers)
// Grant roles. Self-registration only ever creates customers.
adminRoutes.patch('/users/:id/role', requirePermission('users.roles'), c.setRole)
adminRoutes.patch('/users/:id/block', requirePermission('users.block'), c.setBlocked)
// Activating/deactivating a location uses PATCH /api/businesses/:id.
adminRoutes.get('/businesses', requirePermission('businesses.moderate'), c.listBusinesses)
adminRoutes.get('/reservations', requirePermission('reservations.view'), c.listReservations)
adminRoutes.get('/reviews', requirePermission('reviews.moderate'), c.listReviews)
adminRoutes.patch('/reviews/:id', requirePermission('reviews.moderate'), c.setReviewHidden)
adminRoutes.get('/applications', requirePermission('applications.manage'), c.listApplications)
adminRoutes.patch('/applications/:id', requirePermission('applications.manage'), c.decideApplication)
adminRoutes.get('/audit', requirePermission('audit.view'), c.listAudit)
adminRoutes.get('/support', requirePermission('support.manage'), adminTickets)
adminRoutes.get('/statements', requirePermission('finance.view'), c.platformStatement)
adminRoutes.patch('/businesses/:id/commission', requirePermission('finance.view'), c.setCommission)
adminRoutes.get('/donations', requirePermission('donations.view'), c.listDonations)
