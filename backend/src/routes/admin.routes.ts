import { Router } from 'express'
import * as c from '../controllers/admin.controller.js'
import { authenticate, requireRole } from '../middleware/auth.js'

/** Platform administration — admin role only. */
export const adminRoutes = Router()
adminRoutes.use(authenticate, requireRole('admin'))
adminRoutes.get('/stats', c.getStats)
adminRoutes.get('/users', c.listUsers)
// Grant partner/admin roles. Self-registration only ever creates customers.
adminRoutes.patch('/users/:id/role', c.setRole)
// Activating/deactivating a location uses PATCH /api/businesses/:id (admins may edit any location).
adminRoutes.get('/businesses', c.listBusinesses)
