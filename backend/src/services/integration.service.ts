/**
 * Integrations for partners' POS/ERP systems:
 * - API keys (header `X-Api-Key`) act as the partner on partner endpoints
 *   (offers, orders, pickups) — never on account or admin endpoints.
 * - Webhooks receive signed JSON (`X-Zalogaj-Signature: sha256=<hmac>`).
 */
import { createHash, createHmac, randomBytes } from 'node:crypto'
import type { Types } from 'mongoose'
import { isProduction } from '../config/env.js'
import { ApiKey, Business, User, Webhook, type IReservation, type WebhookEvent } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import type { Actor } from './access.service.js'

const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

// --- API keys -----------------------------------------------------------------

export async function listKeys(actor: Actor) {
  const keys = await ApiKey.find({ owner: actor.id, revokedAt: null }).sort({ createdAt: -1 }).lean()
  return keys.map((k) => ({ id: k._id.toString(), name: k.name, prefix: k.prefix, lastUsedAt: k.lastUsedAt?.toISOString(), createdAt: k.createdAt.toISOString() }))
}

export async function createKey(actor: Actor, name: string) {
  if ((await ApiKey.countDocuments({ owner: actor.id, revokedAt: null })) >= 10) throw ApiError.conflict('Najviše 10 aktivnih ključeva.', 'TOO_MANY_KEYS')
  const secret = `zl_live_${randomBytes(24).toString('base64url')}`
  const key = await ApiKey.create({ owner: actor.id, name, prefix: secret.slice(0, 12), hash: sha256(secret) })
  // The full key is returned exactly once.
  return { id: key.id as string, name: key.name, prefix: key.prefix, key: secret, createdAt: key.createdAt.toISOString() }
}

export async function revokeKey(actor: Actor, id: string) {
  const res = await ApiKey.updateOne({ _id: id, owner: actor.id, revokedAt: null }, { $set: { revokedAt: new Date() } })
  if (!res.matchedCount) throw ApiError.notFound('Ključ nije pronađen.')
}

/** Used by the auth middleware. */
export async function userForApiKey(secret: string) {
  const key = await ApiKey.findOne({ hash: sha256(secret), revokedAt: null })
  if (!key) return null
  const user = await User.findById(key.owner).select('role isBlocked deletedAt staffOf').lean()
  if (!user || user.deletedAt || user.isBlocked || (user.role !== 'business' && user.role !== 'admin')) return null
  if (!key.lastUsedAt || Date.now() - key.lastUsedAt.getTime() > 60_000) void ApiKey.updateOne({ _id: key._id }, { $set: { lastUsedAt: new Date() } })
  return { id: user._id.toString(), role: user.role, staffOf: (user.staffOf ?? []).map(String) }
}

// --- Webhooks -----------------------------------------------------------------

function assertSafeUrl(raw: string) {
  let url: URL
  try {
    url = new URL(raw)
  } catch {
    throw ApiError.badRequest('Neispravan URL.', 'INVALID_URL')
  }
  const host = url.hostname
  const isLocal = host === 'localhost' || host === '127.0.0.1'
  if (isProduction && (url.protocol !== 'https:' || isLocal)) throw ApiError.badRequest('Webhook mora biti javna https adresa.', 'INVALID_URL')
  if (!isProduction && url.protocol !== 'https:' && !isLocal) throw ApiError.badRequest('Webhook mora koristiti https.', 'INVALID_URL')
  // Never call into private networks from production.
  if (isProduction && /^(10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.|169\.254\.|0\.)/.test(host)) throw ApiError.badRequest('Privatne adrese nisu dozvoljene.', 'INVALID_URL')
}

function serializeHook(h: InstanceType<typeof Webhook>, secret?: string) {
  return {
    id: h.id as string,
    url: h.url,
    events: h.events,
    isActive: h.isActive,
    lastStatus: h.lastStatus,
    lastError: h.lastError,
    lastDeliveredAt: h.lastDeliveredAt?.toISOString(),
    createdAt: h.createdAt.toISOString(),
    ...(secret ? { secret } : {}),
  }
}

export async function listWebhooks(actor: Actor) {
  const hooks = await Webhook.find({ owner: actor.id }).sort({ createdAt: -1 })
  return hooks.map((h) => serializeHook(h))
}

export async function createWebhook(actor: Actor, input: { url: string; events?: WebhookEvent[] }) {
  assertSafeUrl(input.url)
  if ((await Webhook.countDocuments({ owner: actor.id })) >= 5) throw ApiError.conflict('Najviše 5 webhook-ova.', 'TOO_MANY_WEBHOOKS')
  const secret = `whsec_${randomBytes(24).toString('base64url')}`
  const hook = await Webhook.create({ owner: actor.id, url: input.url, secret, events: input.events })
  return serializeHook(hook, secret)
}

export async function updateWebhook(actor: Actor, id: string, input: { url?: string; events?: WebhookEvent[]; isActive?: boolean }) {
  if (input.url) assertSafeUrl(input.url)
  const hook = await Webhook.findOneAndUpdate({ _id: id, owner: actor.id }, { $set: input }, { new: true })
  if (!hook) throw ApiError.notFound('Webhook nije pronađen.')
  return serializeHook(hook)
}

export async function deleteWebhook(actor: Actor, id: string) {
  const res = await Webhook.deleteOne({ _id: id, owner: actor.id })
  if (!res.deletedCount) throw ApiError.notFound('Webhook nije pronađen.')
}

async function deliver(hookId: Types.ObjectId, event: string, data: unknown) {
  const hook = await Webhook.findById(hookId).select('+secret')
  if (!hook) return
  const body = JSON.stringify({ event, sentAt: new Date().toISOString(), data })
  const signature = createHmac('sha256', hook.secret).update(body).digest('hex')
  try {
    const res = await fetch(hook.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'User-Agent': 'Zalogaj-Webhooks/1', 'X-Zalogaj-Event': event, 'X-Zalogaj-Signature': `sha256=${signature}` },
      body,
      signal: AbortSignal.timeout(5000),
      redirect: 'manual',
    })
    await Webhook.updateOne({ _id: hook._id }, { $set: { lastStatus: res.status, lastDeliveredAt: new Date() }, $unset: { lastError: 1 } })
    return res.status
  } catch (error) {
    await Webhook.updateOne({ _id: hook._id }, { $set: { lastStatus: 0, lastError: String((error as Error).message).slice(0, 200), lastDeliveredAt: new Date() } })
    return 0
  }
}

export async function testWebhook(actor: Actor, id: string) {
  const hook = await Webhook.findOne({ _id: id, owner: actor.id })
  if (!hook) throw ApiError.notFound('Webhook nije pronađen.')
  const status = await deliver(hook._id, 'ping', { message: 'Zalogaj webhook test' })
  return { status }
}

/** Fire-and-forget reservation events to the location owner's webhooks. */
export async function dispatchReservationEvent(event: WebhookEvent, reservation: IReservation & { _id: Types.ObjectId }) {
  try {
    const business = await Business.findById(reservation.business).select('owner name').lean()
    if (!business) return
    const hooks = await Webhook.find({ owner: business.owner, isActive: true, events: event }).select('_id').lean()
    if (!hooks.length) return
    const customer = await User.findById(reservation.user).select('name').lean()
    const data = {
      id: reservation._id.toString(),
      code: reservation.code,
      status: reservation.status,
      quantity: reservation.quantity,
      unitPriceMinor: reservation.unitPriceMinor,
      discountMinor: reservation.discountMinor ?? 0,
      totalMinor: reservation.totalMinor,
      currency: reservation.currency,
      offer: { id: reservation.offer.toString(), title: reservation.offerTitle },
      business: { id: business._id.toString(), name: business.name },
      customer: { name: customer?.name ?? '' },
      pickupStart: reservation.pickupStart.toISOString(),
      pickupEnd: reservation.pickupEnd.toISOString(),
    }
    await Promise.all(hooks.map((h) => deliver(h._id, event, data)))
  } catch (error) {
    console.error('Webhook dispatch failed', error)
  }
}
