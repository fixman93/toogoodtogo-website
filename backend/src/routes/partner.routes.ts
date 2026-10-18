import { Router } from 'express'
import * as c from '../controllers/partner.controller.js'
import { authenticate, requireRole } from '../middleware/auth.js'

const owner = [authenticate, requireRole('business', 'admin')]
const ownerOrStaff = [authenticate, requireRole('business', 'staff', 'admin')]

/** Partner portal endpoints scoped to the signed-in partner's own locations. */
export const partnerRoutes = Router()
partnerRoutes.get('/sales', ...owner, c.getSales)
partnerRoutes.get('/workplaces', authenticate, requireRole('staff'), c.myWorkplaces)
partnerRoutes.get('/orders', ...ownerOrStaff, c.listOrders)
partnerRoutes.get('/suggestion', ...owner, c.suggestion)
partnerRoutes.get('/donations', ...owner, c.listDonations)
partnerRoutes.post('/donations', ...owner, c.createDonation)
partnerRoutes.delete('/donations/:id', ...owner, c.deleteDonation)
partnerRoutes.get('/statements', ...owner, c.statement)
partnerRoutes.get('/statements/outstanding', ...owner, c.outstanding)
partnerRoutes.get('/standing', ...owner, c.standing)
partnerRoutes.get('/integrity', ...owner, c.integrity)
// Staff: who works where (one screen for all locations).
partnerRoutes.get('/team', ...owner, c.team)
partnerRoutes.post('/team', ...owner, c.addTeamMember)
partnerRoutes.put('/team/:userId', ...owner, c.updateTeamMember)
partnerRoutes.get('/api-keys', ...owner, c.listApiKeys)
partnerRoutes.post('/api-keys', ...owner, c.createApiKey)
partnerRoutes.delete('/api-keys/:id', ...owner, c.revokeApiKey)
partnerRoutes.get('/webhooks', ...owner, c.listWebhooks)
partnerRoutes.post('/webhooks', ...owner, c.createWebhook)
partnerRoutes.patch('/webhooks/:id', ...owner, c.updateWebhook)
partnerRoutes.delete('/webhooks/:id', ...owner, c.deleteWebhook)
partnerRoutes.post('/webhooks/:id/test', ...owner, c.testWebhook)

/** "Postani partner" — any signed-in user can apply; admins decide in /admin. */
export const applicationRoutes = Router()
applicationRoutes.use(authenticate)
applicationRoutes.post('/', c.applyAsPartner)
applicationRoutes.get('/me', c.myApplication)
