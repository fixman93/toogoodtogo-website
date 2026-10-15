import { Router } from 'express'
import mongoose from 'mongoose'
import { adminRoutes } from './admin.routes.js'
import { authRoutes } from './auth.routes.js'
import { businessRoutes } from './business.routes.js'
import { favoriteRoutes } from './favorite.routes.js'
import { offerRoutes } from './offer.routes.js'
import { notificationRoutes, waitlistRoutes } from './notification.routes.js'
import { applicationRoutes, partnerRoutes } from './partner.routes.js'
import { pickupRoutes, reservationRoutes } from './reservation.routes.js'

export const apiRouter = Router()

apiRouter.get('/health', (_req, res) => {
  res.json({ data: { status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' } })
})

apiRouter.use('/auth', authRoutes)
apiRouter.use('/admin', adminRoutes)
apiRouter.use('/businesses', businessRoutes)
apiRouter.use('/offers', offerRoutes)
apiRouter.use('/partner', partnerRoutes)
apiRouter.use('/partner-applications', applicationRoutes)
apiRouter.use('/notifications', notificationRoutes)
apiRouter.use('/waitlist', waitlistRoutes)
apiRouter.use('/pickup', pickupRoutes)
apiRouter.use('/reservations', reservationRoutes)
apiRouter.use('/favorites', favoriteRoutes)
