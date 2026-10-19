/**
 * Paid promotion of an offer ("Istakni"). No online payments yet, so the
 * price is added to the partner's monthly statement (see statement.service).
 * - top:  listed first (with an "Istaknuto" badge) until the pickup ends;
 * - push: to everyone who follows the partner (push + e-mail), plus recent customers (push only).
 */
import { Types } from 'mongoose'
import { marketFor } from '../config/markets.js'
import { Boost, Business, Favorite, Notification, Offer, Reservation, User, effectivePriceMinor, type BoostKind } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { assertBusinessAccess, type Actor } from './access.service.js'
import { assertNotSuspended } from './partner-moderation.service.js'
import { notify } from './notification.service.js'
import { sendMail } from './mail.service.js'
import { pickupWindow } from './ticket.service.js'

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
    push: {
      priceMinor: prices.push,
      bought: bought.some((b) => b.kind === 'push'),
      recipients: bought.find((b) => b.kind === 'push')?.recipients ?? null,
      ...(await audience(business, offer._id).then((a) => ({ audience: a.ids.length, followers: a.followers, customers: a.customers }))),
    },
  }
}

/**
 * Who gets the push:
 * - everyone who saved the partner (any of its locations or offers) as a favorite — always,
 *   they chose to follow it;
 * - customers of this location from the last 90 days who don't follow it — at most one
 *   promotional push a day;
 * - never people who already reserved this offer.
 */
async function audience(business: { _id: Types.ObjectId; owner: Types.ObjectId }, offerId: Types.ObjectId) {
  const locations = (await Business.find({ owner: business.owner, deletedAt: null }).select('_id').lean()).map((b) => b._id)
  const offerIds = (await Offer.find({ business: { $in: locations } }).select('_id').lean()).map((o) => o._id)
  const [locationFans, offerFans, customers, alreadyToday, reserved] = await Promise.all([
    Favorite.distinct('user', { targetType: 'business', targetId: { $in: locations } }),
    Favorite.distinct('user', { targetType: 'offer', targetId: { $in: offerIds } }),
    Reservation.distinct('user', { business: business._id, status: 'collected', collectedAt: { $gte: new Date(Date.now() - RECENT_CUSTOMERS_DAYS * 86_400_000) } }),
    Notification.distinct('user', { type: 'offer_boost', createdAt: { $gte: new Date(Date.now() - 86_400_000) } }),
    Reservation.distinct('user', { offer: offerId, status: { $ne: 'cancelled' } }),
  ])
  const skipReserved = new Set(reserved.map(String))
  const notifiedToday = new Set(alreadyToday.map(String))
  const followers = new Set([...locationFans, ...offerFans].map(String))
  const otherCustomers = customers.map(String).filter((id) => !followers.has(id) && !notifiedToday.has(id))
  const fans = [...followers].filter((id) => !skipReserved.has(id))
  const extra = [...new Set(otherCustomers)].filter((id) => !skipReserved.has(id))
  return { ids: [...fans, ...extra], fanIds: fans, followers: fans.length, customers: extra.length }
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
  const reach = kind === 'push' ? await audience(business, offer._id) : null
  const recipients = reach?.ids ?? []
  if (kind === 'push' && recipients.length === 0) {
    throw ApiError.conflict('Još niko nije dodao tvoj lokal ili ponude u omiljene, a nema ni skorašnjih kupaca. Obaveštenje se ne naplaćuje dok nema kome da ode.', 'NO_AUDIENCE')
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
    // Followers also get an e-mail (they chose to follow this partner; respects their e-mail setting).
    void emailFollowers(reach!.fanIds, business, { ...offer.toObject(), id: offer.id as string }, price, percent)
  }
  return { id: boost.id as string, kind, priceMinor: boost.priceMinor, currency: boost.currency, recipients: boost.recipients ?? null }
}

/** One e-mail per follower, sent one after another (gentle on the mail provider's rate limit). */
async function emailFollowers(
  userIds: string[],
  business: { name: string; address: { street: string; city: string } },
  offer: { id: string; title: string; currency: string; originalPriceMinor: number; quantityAvailable: number; pickupStart: Date; pickupEnd: Date; timezone: string },
  price: number,
  percent: number,
) {
  try {
    const users = await User.find({ _id: { $in: userIds }, deletedAt: null, isBlocked: { $ne: true }, 'notificationPrefs.email': { $ne: false } }).select('email').lean()
    const subject = `${business.name}: ${offer.title} za ${money(price, offer.currency)} (−${percent}%)`
    const body = [
      `Lokal koji pratiš na Foodnesi ima ponudu za tebe – još ${offer.quantityAvailable} ${offer.quantityAvailable === 1 ? 'kesa' : 'kese'}.`,
      'Rezerviši u aplikaciji, a plaćaš pri preuzimanju u lokalu.',
      'Ove poruke dobijaš jer si lokal ili njegovu ponudu dodao/la u omiljene. Isključuješ ih u Profilu (e-mail obaveštenja) ili uklanjanjem iz omiljenih.',
    ].join('\n')
    const details: [string, string][] = [
      ['Lokal', business.name],
      ['Adresa', `${business.address.street}, ${business.address.city}`],
      ['Ponuda', offer.title],
      ['Cena', `${money(price, offer.currency)} umesto ${money(offer.originalPriceMinor, offer.currency)}`],
      ['Preuzimanje', pickupWindow(offer.pickupStart, offer.pickupEnd, offer.timezone)],
    ]
    for (const u of users) await sendMail(u.email, subject, body, `/offers/${offer.id}`, 'Rezerviši', { details })
  } catch (error) {
    console.error('Boost e-mails failed', error)
  }
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
