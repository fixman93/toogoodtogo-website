/**
 * Paid promotion of an offer ("Istakni"). No online payments yet, so the
 * price is added to the partner's monthly statement (see statement.service).
 * - top:  listed first (with an "Istaknuto" badge) until the pickup ends;
 * - push: one push to the location's followers and recent customers.
 * Customers get at most one promotional push a day (from any partner).
 */
import { Types } from 'mongoose'
import { marketFor } from '../config/markets.js'
import { Boost, Business, Favorite, Notification, Offer, Reservation, effectivePriceMinor, type BoostKind } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { assertBusinessAccess, type Actor } from './access.service.js'
import { assertNotSuspended } from './partner-moderation.service.js'
import { notify } from './notification.service.js'

const RECENT_CUSTOMERS_DAYS = 90
const money = (minor: number, currency: string) =>
  currency === 'RSD' || currency === 'MKD' ? `${Math.round(minor / 100)} ${currency}` : `${(minor / 100).toFixed(2).replace('.', ',')} ${currency === 'BAM' ? 'KM' : '€'}`

/** Prices and what's already bought for one offer (the "Istakni" sheet). */
export async function options(offerId: string, actor: Actor) {
  const offer = await Offer.findById(offerId).select('business pickupEnd status')
  if (!offer) throw ApiError.notFound('Ponuda nije pronađena.')
  const business = await assertBusinessAccess(offer.business, actor)
  const prices = marketFor(business.address.countryCode).boostPrices
  const bought = await Boost.find({ offer: offer._id }).select('kind recipients createdAt').lean()
  return {
    currency: business.currency,
    top: { priceMinor: prices.top, bought: bought.some((b) => b.kind === 'top') },
    push: { priceMinor: prices.push, bought: bought.some((b) => b.kind === 'push'), recipients: bought.find((b) => b.kind === 'push')?.recipients ?? null, audience: await audience(business._id, offer._id).then((ids) => ids.length) },
  }
}

/** Followers of the location (or of its offers) and its customers of the last 90 days. */
async function audience(businessId: Types.ObjectId, offerId: Types.ObjectId) {
  const offerIds = await Offer.find({ business: businessId }).select('_id').lean()
  const [followers, offerFans, customers, alreadyToday] = await Promise.all([
    Favorite.distinct('user', { targetType: 'business', targetId: businessId }),
    Favorite.distinct('user', { targetType: 'offer', targetId: { $in: offerIds.map((o) => o._id) } }),
    Reservation.distinct('user', { business: businessId, status: 'collected', collectedAt: { $gte: new Date(Date.now() - RECENT_CUSTOMERS_DAYS * 86_400_000) } }),
    // Max one promotional push per person per day.
    Notification.distinct('user', { type: 'offer_boost', createdAt: { $gte: new Date(Date.now() - 86_400_000) } }),
  ])
  void offerId
  const skip = new Set(alreadyToday.map(String))
  // Users who already reserved this offer don't need the push.
  const reserved = new Set((await Reservation.distinct('user', { offer: offerId, status: { $ne: 'cancelled' } })).map(String))
  return [...new Set([...followers, ...offerFans, ...customers].map(String))].filter((id) => !skip.has(id) && !reserved.has(id))
}

export async function buy(offerId: string, kind: BoostKind, actor: Actor) {
  const offer = await Offer.findById(offerId)
  if (!offer || offer.status === 'archived') throw ApiError.notFound('Ponuda nije pronađena.')
  const business = await assertBusinessAccess(offer.business, actor)
  await assertNotSuspended(business)
  if (offer.status !== 'active' || offer.pickupEnd <= new Date()) throw ApiError.conflict('Istaći se može samo aktivna ponuda.', 'OFFER_NOT_ACTIVE')
  if (offer.quantityAvailable === 0) throw ApiError.conflict('Ponuda je rasprodata.', 'SOLD_OUT')
  if (await Boost.exists({ offer: offer._id, kind })) throw ApiError.conflict('Ova ponuda je već istaknuta na taj način.', 'ALREADY_BOOSTED')

  const prices = marketFor(business.address.countryCode).boostPrices
  const recipients = kind === 'push' ? await audience(business._id, offer._id) : []
  if (kind === 'push' && recipients.length === 0) {
    throw ApiError.conflict('Trenutno nema kome da se pošalje obaveštenje (nema pratilaca ni skorašnjih kupaca, ili su danas već dobili jedno).', 'NO_AUDIENCE')
  }
  const boost = await Boost.create({
    business: business._id,
    owner: business.owner,
    offer: offer._id,
    kind,
    priceMinor: prices[kind],
    currency: business.currency,
    timezone: business.timezone,
    createdBy: actor.id,
    ...(kind === 'top' ? { until: offer.pickupEnd } : { recipients: recipients.length }),
  }).catch((error: { code?: number }) => {
    if (error.code === 11000) throw ApiError.conflict('Ova ponuda je već istaknuta na taj način.', 'ALREADY_BOOSTED')
    throw error
  })

  if (kind === 'top') {
    await Offer.updateOne({ _id: offer._id }, { $set: { boostedUntil: offer.pickupEnd } })
  } else {
    const price = effectivePriceMinor(offer)
    const percent = Math.round((1 - price / offer.originalPriceMinor) * 100)
    void notify(
      recipients.map((id) => new Types.ObjectId(id)),
      {
        type: 'offer_boost',
        title: `${business.name}: još ${offer.quantityAvailable} ${offer.quantityAvailable === 1 ? 'kesa' : 'kese'}`,
        body: `${offer.title} za ${money(price, offer.currency)} (−${percent}%). Rezerviši pre nego što nestane.`,
        link: `/offers/${offer.id}`,
      },
      { email: false },
    )
  }
  return { id: boost.id as string, kind, priceMinor: boost.priceMinor, currency: boost.currency, recipients: boost.recipients ?? null }
}

/** Partner's promotions in a month (statement detail). */
export async function listForOwner(ownerId: string | Types.ObjectId, start: Date, end: Date) {
  const rows = await Boost.find({ owner: ownerId, createdAt: { $gte: start, $lt: end } }).sort({ createdAt: -1 }).lean()
  const offers = new Map((await Offer.find({ _id: { $in: rows.map((r) => r.offer) } }).select('title').lean()).map((o) => [o._id.toString(), o.title]))
  const names = new Map((await Business.find({ _id: { $in: rows.map((r) => r.business) } }).select('name').lean()).map((b) => [b._id.toString(), b.name]))
  return rows.map((r) => ({
    id: r._id.toString(),
    kind: r.kind,
    priceMinor: r.priceMinor,
    currency: r.currency,
    offerTitle: offers.get(r.offer.toString()) ?? '—',
    businessName: names.get(r.business.toString()) ?? '—',
    recipients: r.recipients ?? null,
    createdAt: r.createdAt.toISOString(),
    timezone: r.timezone,
  }))
}
