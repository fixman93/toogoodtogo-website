/**
 * In-app notifications. `notify` never throws: a failed notification must
 * not break the action that triggered it (reservation, cancellation, …).
 */
import type { Types } from 'mongoose'
import { Notification, User, type NotificationType } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import type { Actor } from './access.service.js'
import { sendMail } from './mail.service.js'
import { sendToUsers } from './push.service.js'

export interface NotificationInput {
  type: NotificationType
  title: string
  body?: string
  link?: string
}

export async function notify(userIds: (string | Types.ObjectId)[], input: NotificationInput) {
  const unique = [...new Set(userIds.map(String))]
  if (!unique.length) return
  try {
    await Notification.insertMany(unique.map((user) => ({ user, ...input })))
    // Deliver outside the app as well, respecting each user's preferences.
    const users = await User.find({ _id: { $in: unique }, deletedAt: null, isBlocked: { $ne: true } }).select('email notificationPrefs').lean()
    const pushTo = users.filter((u) => u.notificationPrefs?.push !== false).map((u) => u._id)
    const mailTo = users.filter((u) => u.notificationPrefs?.email !== false)
    await Promise.all([
      sendToUsers(pushTo, input),
      ...mailTo.map((u) => sendMail(u.email, input.title, input.body ?? '', input.link)),
    ])
  } catch (error) {
    console.error('Failed to deliver notifications', error)
  }
}

export async function list(actor: Actor, limit = 30) {
  const [items, unread] = await Promise.all([
    Notification.find({ user: actor.id }).sort({ createdAt: -1 }).limit(limit).lean(),
    Notification.countDocuments({ user: actor.id, readAt: null }),
  ])
  return {
    unread,
    items: items.map((n) => ({
      id: n._id.toString(),
      type: n.type,
      title: n.title,
      body: n.body,
      link: n.link,
      read: !!n.readAt,
      createdAt: n.createdAt.toISOString(),
    })),
  }
}

export async function unreadCount(actor: Actor) {
  return { unread: await Notification.countDocuments({ user: actor.id, readAt: null }) }
}

export async function markAllRead(actor: Actor) {
  await Notification.updateMany({ user: actor.id, readAt: null }, { $set: { readAt: new Date() } })
  return { unread: 0 }
}

export async function markRead(id: string, actor: Actor) {
  const result = await Notification.updateOne({ _id: id, user: actor.id }, { $set: { readAt: new Date() } })
  if (!result.matchedCount) throw ApiError.notFound('Obaveštenje nije pronađeno.')
}
