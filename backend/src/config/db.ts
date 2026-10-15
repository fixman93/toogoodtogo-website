import mongoose from 'mongoose'
import { env } from './env.js'

let transactionsSupported = false

/** True when multi-document transactions can be used (replica set / Atlas). */
export const supportsTransactions = () => transactionsSupported

export async function connectDatabase(uri = env.MONGODB_URI) {
  mongoose.set('strictQuery', true)
  await mongoose.connect(uri, { serverSelectionTimeoutMS: 10_000 })

  // Transactions need a replica set or sharded cluster (every Atlas tier qualifies).
  const hello = await mongoose.connection.db!.admin().command({ hello: 1 })
  const isReplicaSetOrSharded = Boolean(hello.setName) || hello.msg === 'isdbgrid'
  transactionsSupported = env.MONGODB_TRANSACTIONS === 'off' ? false : isReplicaSetOrSharded

  if (env.MONGODB_TRANSACTIONS === 'on' && !isReplicaSetOrSharded) {
    throw new Error('MONGODB_TRANSACTIONS=on but the MongoDB server is a standalone instance (no replica set).')
  }

  console.log(`✅ MongoDB connected (${mongoose.connection.name}), transactions: ${transactionsSupported ? 'on' : 'off'}`)
}

export async function disconnectDatabase() {
  await mongoose.disconnect()
}
