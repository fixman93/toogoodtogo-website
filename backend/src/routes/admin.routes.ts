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
// Staff role = chosen locations of one partner.
adminRoutes.get('/users/:id/staff-access', requirePermission('users.roles'), c.getStaffAccess)
adminRoutes.put('/users/:id/staff-access', requirePermission('users.roles'), c.setStaffAccess)
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
adminRoutes.get('/statements/outstanding', requirePermission('finance.view'), c.outstanding)
// Confirm what a partner paid (or what the platform paid out) for a month.
adminRoutes.post('/payments', requirePermission('finance.manage'), c.recordPayment)
adminRoutes.delete('/payments/:id', requirePermission('finance.manage'), c.deletePayment)
// Partner moderation: warnings, pause, block, delete (all visible to the partner).
adminRoutes.get('/partners/:id/standing', requirePermission('partners.manage'), c.partnerStanding)
adminRoutes.get('/partners/:id/stats', requirePermission('partners.manage'), c.partnerStats)
adminRoutes.patch('/partners/:id/status', requirePermission('partners.manage'), c.setPartnerStatus)
adminRoutes.post('/partners/:id/warnings', requirePermission('partners.manage'), c.warnPartner)
adminRoutes.patch('/partner-notes/:id/resolve', requirePermission('partners.manage'), c.resolveWarning)
adminRoutes.delete('/partners/:id', requirePermission('partners.manage'), c.deletePartner)
// Pickup integrity: are hand-overs recorded (scanned)? + disputes on customer-confirmed pickups.
adminRoutes.get('/integrity', requirePermission('integrity.view'), c.integrity)
adminRoutes.get('/disputes', requirePermission('integrity.view'), c.listDisputes)
adminRoutes.get('/integrity/alerts', requirePermission('integrity.view'), c.integrityAlerts)
adminRoutes.patch('/disputes/:id', requirePermission('partners.manage'), c.resolveDispute)
adminRoutes.patch('/businesses/:id/commission', requirePermission('finance.view'), c.setCommission)
adminRoutes.get('/donations', requirePermission('donations.view'), c.listDonations)
