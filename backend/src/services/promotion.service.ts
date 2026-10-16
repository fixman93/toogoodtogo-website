/**
 * Promo codes. Discounts are applied when reserving (the bag is then paid at
 * the reduced price in the shop). Usage is counted atomically so a limited
 * code can't be over-used by concurrent reservations.
 */
import type { ClientSession, Types } from 'mongoose'
import { Business, Promotion, Reservation, type IPromotion } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { env } from '../config/env.js'
import { MARKETS, marketFor } from '../config/markets.js'
import { assertBusinessAccess, hasPermission, partnerLocale, type Actor } from './access.service.js'
import { audit } from './audit.service.js'

type PromotionDoc = InstanceType<typeof Promotion>

export function serialize(p: PromotionDoc) {
  return {
    id: p.id as string,
    code: p.code,
    description: p.description,
    discountType: p.discountType,
    value: p.value,
    currency: p.currency ?? null,
    scope: p.owner ? ('partner' as const) : ('platform' as const),
    businessId: p.business?.toString(),
    validFrom: p.validFrom?.toISOString(),
    validTo: p.validTo?.toISOString(),
    maxUses: p.maxUses ?? null,
    usesCount: p.usesCount,
    perUserLimit: p.perUserLimit,
    isActive: p.isActive,
    createdAt: p.createdAt.toISOString(),
  }
}

export function discountFor(promo: Pick<IPromotion, 'discountType' | 'value'>, subtotalMinor: number) {
  const raw = promo.discountType === 'percent' ? Math.round((subtotalMinor * Math.min(promo.value, 90)) / 100) : promo.value
  // Never make a bag free: at least one whole currency unit (100 minor units) remains to pay.
  return Math.max(0, Math.min(raw, subtotalMinor - 100))
}

/** Validates a code for a reservation; returns the promotion (not yet counted). */
export async function resolve(code: string, ctx: { businessId: Types.ObjectId; userId: string; currency: string }) {
  const promo = await Promotion.findOne({ code: code.trim().toUpperCase() })
  const now = new Date()
  if (!promo || !promo.isActive) throw ApiError.badRequest('Promo kod ne postoji ili nije aktivan.', 'PROMO_INVALID')
  if ((promo.validFrom && promo.validFrom > now) || (promo.validTo && promo.validTo < now)) throw ApiError.badRequest('Promo kod trenutno ne važi.', 'PROMO_EXPIRED')
  if (promo.maxUses != null && promo.usesCount >= promo.maxUses) throw ApiError.conflict('Promo kod je iskorišćen.', 'PROMO_EXHAUSTED')
  // Fixed amounts are in one currency (codes created before currencies were stored are in the default market's).
  if (promo.discountType === 'fixed' && (promo.currency ?? marketFor(env.DEFAULT_MARKET).currency) !== ctx.currency) {
    throw ApiError.badRequest('Promo kod ne važi za ponude u ovoj valuti.', 'PROMO_NOT_APPLICABLE')
  }
  if (promo.business && !promo.business.equals(ctx.businessId)) throw ApiError.badRequest('Promo kod ne važi za ovaj lokal.', 'PROMO_NOT_APPLICABLE')
  if (promo.owner && !promo.business) {
    const business = await Business.findById(ctx.businessId).select('owner').lean()
    if (!business || !business.owner.equals(promo.owner)) throw ApiError.badRequest('Promo kod ne važi za ovaj lokal.', 'PROMO_NOT_APPLICABLE')
  }
  const used = await Reservation.countDocuments({ user: ctx.userId, promotion: promo._id, status: { $ne: 'cancelled' } })
  if (used >= promo.perUserLimit) throw ApiError.conflict('Već si iskoristio ovaj promo kod.', 'PROMO_ALREADY_USED')
  return promo
}

/** Atomically count one use (respecting maxUses). */
export async function consume(promo: PromotionDoc, session?: ClientSession) {
  const filter: Record<string, unknown> = { _id: promo._id, isActive: true }
  if (promo.maxUses != null) filter.usesCount = { $lt: promo.maxUses }
  const updated = await Promotion.findOneAndUpdate(filter, { $inc: { usesCount: 1 } }, { new: true, session })
  if (!updated) throw ApiError.conflict('Promo kod je upravo iskorišćen.', 'PROMO_EXHAUSTED')
}

export async function release(promotionId: Types.ObjectId, session?: ClientSession) {
  await Promotion.updateOne({ _id: promotionId, usesCount: { $gt: 0 } }, { $inc: { usesCount: -1 } }, { session })
}

/** Preview for the reservation panel. */
export async function check(input: { code: string; offerPriceMinor: number; quantity: number; businessId: Types.ObjectId; currency: string }, actor: Actor) {
  const promo = await resolve(input.code, { businessId: input.businessId, userId: actor.id, currency: input.currency })
  const subtotal = input.offerPriceMinor * input.quantity
  const discountMinor = discountFor(promo, subtotal)
  return { code: promo.code, description: promo.description, discountMinor, totalMinor: subtotal - discountMinor }
}

type PromoInput = {
  code: string
  description?: string
  discountType: 'percent' | 'fixed'
  value: number
  /** Required for a fixed platform discount; partner codes use the partner's currency. */
  currency?: string
  businessId?: string
  validFrom?: Date
  validTo?: Date
  maxUses?: number | null
  perUserLimit?: number
  platform?: boolean
}

export async function create(input: PromoInput, actor: Actor) {
  const platform = input.platform === true
  if (platform && !hasPermission(actor, 'promotions.manage')) throw ApiError.forbidden()
  if (!platform && actor.role !== 'business' && actor.role !== 'admin') throw ApiError.forbidden()
  if (input.discountType === 'percent' && input.value > 90) throw ApiError.badRequest('Popust može biti najviše 90%.', 'INVALID_DISCOUNT')
  if (input.businessId) await assertBusinessAccess(input.businessId, actor)
  if (await Promotion.exists({ code: input.code.toUpperCase() })) throw ApiError.conflict('Taj kod već postoji.', 'PROMO_CODE_TAKEN')
  let currency: string | undefined
  if (input.discountType === 'fixed') {
    currency = platform ? input.currency : (await partnerLocale(actor.id)).currency
    if (!currency || !Object.values(MARKETS).some((m) => m.currency === currency)) {
      throw ApiError.badRequest('Izaberi valutu popusta.', 'CURRENCY_REQUIRED')
    }
  }
  const promo = await Promotion.create({
    code: input.code,
    description: input.description,
    discountType: input.discountType,
    value: input.value,
    currency,
    owner: platform ? undefined : actor.id,
    business: platform ? undefined : input.businessId,
    validFrom: input.validFrom,
    validTo: input.validTo,
    maxUses: input.maxUses ?? null,
    perUserLimit: input.perUserLimit ?? 1,
    createdBy: actor.id,
  })
  if (platform) void audit(actor, { action: 'promotion.create', targetType: 'promotion', targetId: promo._id, summary: `Nov promo kod platforme: ${promo.code}` })
  return serialize(promo)
}

/** Partners see their own codes; promotions.manage sees platform codes (or all with scope=all). */
export async function list(actor: Actor, scope: 'mine' | 'platform' | 'all') {
  let filter: Record<string, unknown> = { owner: actor.id }
  if (scope !== 'mine') {
    if (!hasPermission(actor, 'promotions.manage')) throw ApiError.forbidden()
    filter = scope === 'platform' ? { owner: null } : {}
  }
  const promos = await Promotion.find(filter).sort({ createdAt: -1 }).limit(200)
  return promos.map(serialize)
}

export async function update(id: string, input: { isActive?: boolean; maxUses?: number | null; validTo?: Date | null; description?: string }, actor: Actor) {
  const promo = await Promotion.findById(id)
  if (!promo) throw ApiError.notFound('Promo kod nije pronađen.')
  const canEdit = promo.owner ? promo.owner.toString() === actor.id || hasPermission(actor, 'promotions.manage') : hasPermission(actor, 'promotions.manage')
  if (!canEdit) throw ApiError.forbidden()
  if (input.isActive != null) promo.isActive = input.isActive
  if (input.maxUses !== undefined) promo.maxUses = input.maxUses
  if (input.validTo !== undefined) promo.validTo = input.validTo ?? undefined
  if (input.description != null) promo.description = input.description
  await promo.save()
  if (!promo.owner) void audit(actor, { action: 'promotion.update', targetType: 'promotion', targetId: promo._id, summary: `Izmenjen promo kod: ${promo.code}` })
  return serialize(promo)
}
