import { env } from './config/env.js'
import { connectDatabase, disconnectDatabase } from './config/db.js'
import { createApp } from './app.js'
import { expireStale } from './services/reservation.service.js'

const EXPIRY_INTERVAL_MS = 5 * 60_000

async function main() {
  await connectDatabase()

  const server = createApp().listen(env.PORT, () => {
    console.log(`🚀 API listening on http://localhost:${env.PORT}/api (${env.NODE_ENV})`)
  })

  const expiryTimer = setInterval(() => {
    expireStale()
      .then((n) => n && console.log(`⏱  Expired ${n} unclaimed reservation(s)`))
      .catch((e) => console.error('Expiry job failed', e))
  }, EXPIRY_INTERVAL_MS)

  const shutdown = async (signal: string) => {
    console.log(`${signal} received, shutting down…`)
    clearInterval(expiryTimer)
    server.close()
    await disconnectDatabase()
    process.exit(0)
  }
  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))
}

main().catch((error) => {
  console.error('❌ Failed to start server:', error instanceof Error ? error.message : error)
  process.exit(1)
})
