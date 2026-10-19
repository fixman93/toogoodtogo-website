import { Router } from 'express'
import mongoose from 'mongoose'
import { adminRoutes } from './admin.routes.js'
import { authRoutes } from './auth.routes.js'
import { businessRoutes } from './business.routes.js'
import { favoriteRoutes } from './favorite.routes.js'
import { offerRoutes } from './offer.routes.js'
import { notificationRoutes, waitlistRoutes } from './notification.routes.js'
import { applicationRoutes, partnerRoutes } from './partner.routes.js'
import { promotionRoutes } from './promotion.routes.js'
import { pushRoutes } from './push.routes.js'
import { supportRoutes } from './support.routes.js'
import { uploadRoutes } from './upload.routes.js'
import { pickupRoutes, reservationRoutes } from './reservation.routes.js'
import { scheduleRoutes } from './schedule.routes.js'

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
apiRouter.use('/push', pushRoutes)
apiRouter.use('/promotions', promotionRoutes)
apiRouter.use('/support', supportRoutes)
apiRouter.use('/uploads', uploadRoutes)
apiRouter.use('/reservations', reservationRoutes)
apiRouter.use('/favorites', favoriteRoutes)
apiRouter.use('/offer-schedules', scheduleRoutes)
