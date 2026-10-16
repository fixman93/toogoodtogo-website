/**
 * Web push (VAPID). Optional: without VAPID keys in the environment the app
 * still works, it just doesn't send push messages.
 */
import webpush from 'web-push'
import type { Types } from 'mongoose'
import { env } from '../config/env.js'
import { PushSubscription } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import type { Actor } from './access.service.js'

const configured = Boolean(env.VAPID_PUBLIC_KEY && env.VAPID_PRIVATE_KEY)
if (configured) webpush.setVapidDetails(env.VAPID_SUBJECT, env.VAPID_PUBLIC_KEY!, env.VAPID_PRIVATE_KEY!)

export const pushEnabled = () => configured

export function publicKey() {
  return { enabled: configured, publicKey: configured ? env.VAPID_PUBLIC_KEY : null }
}

export async function subscribe(actor: Actor, sub: { endpoint: string; keys: { p256dh: string; auth: string } }, userAgent?: string) {
  if (!configured) throw ApiError.conflict('Push obaveštenja nisu podešena na serveru.', 'PUSH_DISABLED')
  await PushSubscription.updateOne(
    { endpoint: sub.endpoint },
    { $set: { user: actor.id, keys: sub.keys, userAgent: userAgent?.slice(0, 200) } },
    { upsert: true },
  )
}

export async function unsubscribe(actor: Actor, endpoint: string) {
  await PushSubscription.deleteOne({ endpoint, user: actor.id })
}

/**
 * Send to every device of these users; dead subscriptions (404/410) are removed.
 * Returns the ids of users reached on at least one device.
 */
export async function sendToUsers(userIds: (string | Types.ObjectId)[], payload: { title: string; body?: string; link?: string }) {
  const reached = new Set<string>()
  if (!configured || !userIds.length) return reached
  const subs = await PushSubscription.find({ user: { $in: userIds } }).lean()
  const data = JSON.stringify({ ...payload, url: payload.link ? new URL(payload.link, env.APP_URL).toString() : env.APP_URL })
  await Promise.all(
    subs.map((s) =>
      webpush
        .sendNotification({ endpoint: s.endpoint, keys: s.keys }, data, { TTL: 3600 })
        .then(() => reached.add(s.user.toString()))
        .catch(async (error: { statusCode?: number }) => {
          if (error.statusCode === 404 || error.statusCode === 410) await PushSubscription.deleteOne({ _id: s._id })
          else console.error('Push failed', error.statusCode ?? error)
        }),
    ),
  )
  return reached
}
