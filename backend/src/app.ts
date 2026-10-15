import cors from 'cors'
import express from 'express'
import helmet from 'helmet'
import { env } from './config/env.js'
import { errorHandler, notFoundHandler } from './middleware/errorHandler.js'
import { apiRouter } from './routes/index.js'

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)
  app.disable('x-powered-by')
  app.use(helmet())
  app.use(
    cors({
      origin: (origin, callback) => callback(null, !origin || env.CORS_ORIGINS.includes(origin)),
      credentials: false,
    }),
  )
  app.use(express.json({ limit: '100kb' }))

  app.use('/api', apiRouter)

  app.use(notFoundHandler)
  app.use(errorHandler)
  return app
}
