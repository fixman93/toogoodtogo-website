import { MongoMemoryServer } from 'mongodb-memory-server'
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../config/db.js'

let server: MongoMemoryServer | undefined

/** One in-memory MongoDB per test file. Call in beforeAll. */
export async function startTestDb() {
  server = await MongoMemoryServer.create()
  await connectDatabase(server.getUri())
}

/** Call in afterAll. */
export async function stopTestDb() {
  await disconnectDatabase()
  await server?.stop()
}

/** Call in afterEach/beforeEach so tests don't see each other's data. */
export async function resetTestDb() {
  const { collections } = mongoose.connection
  await Promise.all(Object.values(collections).map((c) => c.deleteMany({})))
}
