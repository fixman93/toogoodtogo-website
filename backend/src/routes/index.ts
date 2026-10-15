import { Router } from 'express'
import mongoose from 'mongoose'
import { adminRoutes, authRoutes } from './auth.routes.js'
import { businessRoutes } from './business.routes.js'
import { favoriteRoutes } from './favorite.routes.js'
import { offerRoutes } from './offer.routes.js'
import { reservationRoutes } from './reservation.routes.js'

export const apiRouter = Router()

apiRouter.get('/health', (_req, res) => {
  res.json({ data: { status: 'ok', database: mongoose.connection.readyState === 1 ? 'connected' : 'disconnected' } })
})

apiRouter.use('/auth', authRoutes)
apiRouter.use('/admin', adminRoutes)
apiRouter.use('/businesses', businessRoutes)
apiRouter.use('/offers', offerRoutes)
apiRouter.use('/reservations', reservationRoutes)
apiRouter.use('/favorites', favoriteRoutes)
