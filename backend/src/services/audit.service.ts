import type { Types } from 'mongoose'
import { AuditLog, User, type IAuditLog } from '../models/index.js'
import type { Actor } from './access.service.js'

/** Record an administrative change. Never throws. */
export async function audit(
  actor: Actor,
  entry: { action: string; targetType: IAuditLog['targetType']; targetId: Types.ObjectId | string; summary: string; details?: Record<string, unknown> },
) {
  try {
    await AuditLog.create({ actor: actor.id, ...entry })
  } catch (error) {
    console.error('Audit log failed', error)
  }
}

export async function list(page: number, limit: number) {
  const [rows, total] = await Promise.all([
    AuditLog.find().sort({ createdAt: -1 }).skip((page - 1) * limit).limit(limit).lean(),
    AuditLog.countDocuments(),
  ])
  const actors = new Map((await User.find({ _id: { $in: rows.map((r) => r.actor) } }).select('name email').lean()).map((u) => [u._id.toString(), u]))
  return {
    items: rows.map((r) => {
      const actor = actors.get(r.actor.toString())
      return {
        id: r._id.toString(),
        action: r.action,
        targetType: r.targetType,
        targetId: r.targetId.toString(),
        summary: r.summary,
        actor: actor ? { id: actor._id.toString(), name: actor.name, email: actor.email } : null,
        createdAt: r.createdAt.toISOString(),
      }
    }),
    meta: { page, limit, total },
  }
}
