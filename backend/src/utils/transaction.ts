import mongoose, { type ClientSession } from 'mongoose'
import { supportsTransactions } from '../config/db.js'

/**
 * Runs `work` inside a multi-document transaction when the deployment
 * supports it (Atlas, replica sets). On a standalone server it runs without a
 * session; callers must then keep each step individually atomic and register
 * compensating actions via `onRollback`, which run if `work` throws.
 */
export async function runAtomically<T>(
  work: (session: ClientSession | undefined, onRollback: (undo: () => Promise<unknown>) => void) => Promise<T>,
): Promise<T> {
  if (supportsTransactions()) {
    const session = await mongoose.startSession()
    try {
      return await session.withTransaction(() => work(session, () => {}))
    } finally {
      await session.endSession()
    }
  }

  const compensations: (() => Promise<unknown>)[] = []
  try {
    return await work(undefined, (undo) => compensations.push(undo))
  } catch (error) {
    for (const undo of compensations.reverse()) {
      await undo().catch((e) => console.error('Compensation failed', e))
    }
    throw error
  }
}
