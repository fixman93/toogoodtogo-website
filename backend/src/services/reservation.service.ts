import { randomBytes } from 'node:crypto'
import type { Types } from 'mongoose'
import { env } from '../config/env.js'
import { getMarket } from '../config/markets.js'
import {
  ACTIVE_RESERVATION_STATUSES,
  Business,
  Offer,
  Reservation,
  Review,
  User,
  type IBusiness,
  type IReservation,
  type ReservationDoc,
} from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { serializeReservation } from '../utils/serializers.js'
import { pickupCode } from '../utils/text.js'
import { runAtomically } from '../utils/transaction.js'
import type { ReservationListQuery } from '../validators/reservation.validators.js'
import { assertBusinessAccess, isAdmin, type Actor } from './access.service.js'
import { notify } from './notification.service.js'
import { notifyIfAvailable } from './waitlist.service.js'

const market = () => getMarket(env.DEFAULT_MARKET)
type BusinessWithId = IBusiness & { _id: Types.ObjectId }
type ReservationWithId = IReservation & { _id: Types.ObjectId }

const isActive = (r: IReservation) => ACTIVE_RESERVATION_STATUSES.includes(r.status)

/** Customers can cancel until the market's cutoff before pickup; the business any time while active. */
function canCancel(r: IReservation, actor: Actor, business: IBusiness) {
  if (!isActive(r)) return false
  const isStaff = isAdmin(actor) || business.owner.toString() === actor.id
  if (isStaff) return true
  return Date.now() < r.pickupStart.getTime() - market().cancellationCutoffMinutes * 60_000
}

export async function toDto(reservations: ReservationWithId[], actor: Actor) {
  const ids = [...new Set(reservations.map((r) => r.business.toString()))]
  const businesses = new Map((await Business.find({ _id: { $in: ids } })).map((b) => [b.id as string, b as BusinessWithId]))
  const isStaffFor = (business: IBusiness) => isAdmin(actor) || business.owner.toString() === actor.id

  // Staff need the customer's name at the counter; customers never see other users.
  const staffUserIds = reservations.filter((r) => isStaffFor(businesses.get(r.business.toString())!)).map((r) => r.user)
  const customers = new Map(
    (staffUserIds.length ? await User.find({ _id: { $in: staffUserIds } }).select('name').lean() : []).map((u) => [u._id.toString(), u.name]),
  )
  const collectedIds = reservations.filter((r) => r.status === 'collected').map((r) => r._id)
  const reviewed = new Set(
    (collectedIds.length ? await Review.find({ reservation: { $in: collectedIds } }).select('reservation').lean() : []).map((r) => r.reservation.toString()),
  )

  return reservations.map((r) => {
    const business = businesses.get(r.business.toString())!
    const customerName = isStaffFor(business) ? customers.get(r.user.toString()) : undefined
    return { ...serializeReservation(r, business, canCancel(r, actor, business), customerName), reviewed: reviewed.has(r._id.toString()) }
  })
}

/** Pickup code that is unique among the business's active reservations. */
async function uniquePickupCode(businessId: Types.ObjectId) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = pickupCode()
    if (!(await Reservation.exists({ business: businessId, code, status: { $in: ACTIVE_RESERVATION_STATUSES } }))) return code
  }
  throw new ApiError(503, 'CODE_GENERATION_FAILED', 'Pokušajte ponovo.')
}

/** Explains why the atomic reservation update matched nothing. */
async function unavailableReason(offerId: string, quantity: number) {
  const offer = await Offer.findById(offerId)
  if (!offer || offer.status === 'archived') return ApiError.notFound('Ponuda nije pronađena.')
  if (offer.status !== 'active') return ApiError.conflict('Ponuda trenutno nije dostupna.', 'OFFER_UNAVAILABLE')
  if (offer.pickupEnd <= new Date()) return ApiError.conflict('Vreme preuzimanja je isteklo.', 'OFFER_EXPIRED')
  if (quantity > offer.maxPerReservation)
    return ApiError.badRequest(`Možete rezervisati najviše ${offer.maxPerReservation}.`, 'INVALID_QUANTITY')
  return ApiError.conflict(
    offer.quantityAvailable === 0 ? 'Rasprodato.' : `Dostupno je još samo ${offer.quantityAvailable}.`,
    'SOLD_OUT',
  )
}

/**
 * Reserve bags without overselling: the stock check and the decrement happen
 * in ONE conditional update (`quantityAvailable >= quantity`), so concurrent
 * requests can never push availability below zero. With transactions the
 * reservation insert commits together with the decrement; without them, a
 * failed insert triggers a compensating increment.
 */
export async function create(input: { offerId: string; quantity: number }, actor: Actor) {
  const { offerId, quantity } = input

  const reservation = await runAtomically(async (session, onRollback) => {
    const offer = await Offer.findOneAndUpdate(
      {
        _id: offerId,
        status: 'active',
        pickupEnd: { $gt: new Date() },
        quantityAvailable: { $gte: quantity },
        maxPerReservation: { $gte: quantity },
      },
      { $inc: { quantityAvailable: -quantity, reservedCount: quantity } },
      { new: true, session },
    )
    if (!offer) throw await unavailableReason(offerId, quantity)
    onRollback(() => Offer.updateOne({ _id: offer._id }, { $inc: { quantityAvailable: quantity, reservedCount: -quantity } }))

    const [created] = await Reservation.create(
      [
        {
          user: actor.id,
          offer: offer._id,
          business: offer.business,
          code: await uniquePickupCode(offer.business),
          quantity,
          unitPriceMinor: offer.priceMinor,
          originalUnitPriceMinor: offer.originalPriceMinor,
          totalMinor: offer.priceMinor * quantity,
          currency: offer.currency,
          offerTitle: offer.title,
          offerImageUrl: offer.imageUrl,
          pickupStart: offer.pickupStart,
          pickupEnd: offer.pickupEnd,
          timezone: offer.timezone,
          // Payments are not integrated yet: confirm immediately, pay at pickup.
          // Online payments will create `pending_payment` + payment.holdExpiresAt instead.
          status: 'confirmed',
          payment: { status: 'not_required', method: 'pay_at_pickup' },
        },
      ],
      { session },
    )
    return created
  })

  const [dto] = await toDto([reservation.toObject()], actor)
  const business = await Business.findById(reservation.business).select('owner name').lean()
  if (business) {
    void notify([business.owner], {
      type: 'reservation_new',
      title: `Nova rezervacija · ${reservation.code}`,
      body: `${reservation.quantity} × ${reservation.offerTitle} (${business.name})`,
      link: '/business/orders',
    })
  }
  return dto
}

export async function list(query: ReservationListQuery, actor: Actor) {
  const filter: Record<string, unknown> = {}
  if (query.businessId) {
    await assertBusinessAccess(query.businessId, actor)
    filter.business = query.businessId
  } else {
    filter.user = actor.id
  }

  let sort: Record<string, 1 | -1> = { pickupStart: -1 }
  if (query.scope === 'upcoming') {
    filter.status = { $in: ACTIVE_RESERVATION_STATUSES }
    sort = { pickupStart: 1 }
  } else if (query.scope === 'history') {
    filter.status = { $nin: ACTIVE_RESERVATION_STATUSES }
  }

  const [items, total] = await Promise.all([
    Reservation.find(filter).sort(sort).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
    Reservation.countDocuments(filter),
  ])
  return { items: await toDto(items, actor), meta: { page: query.page, limit: query.limit, total } }
}

/** Customer who made it, the business owner, or an admin. Others get 404 (no existence leak). */
async function loadAuthorized(id: string, actor: Actor): Promise<{ reservation: ReservationDoc; isStaff: boolean }> {
  const reservation = await Reservation.findById(id)
  if (!reservation) throw ApiError.notFound('Rezervacija nije pronađena.')
  if (reservation.user.toString() === actor.id) return { reservation, isStaff: isAdmin(actor) }
  const business = await Business.findById(reservation.business)
  const isStaff = isAdmin(actor) || business?.owner.toString() === actor.id
  if (!isStaff) throw ApiError.notFound('Rezervacija nije pronađena.')
  return { reservation, isStaff }
}

export async function get(id: string, actor: Actor) {
  const { reservation } = await loadAuthorized(id, actor)
  const [dto] = await toDto([reservation.toObject()], actor)
  return dto
}

export async function cancel(id: string, actor: Actor) {
  const { reservation, isStaff } = await loadAuthorized(id, actor)
  const business = await Business.findById(reservation.business)
  if (!business || !canCancel(reservation, actor, business)) {
    throw ApiError.conflict('Rezervacija se više ne može otkazati.', 'CANCELLATION_NOT_ALLOWED')
  }

  const cancelled = await runAtomically(async (session, onRollback) => {
    // Status guard makes cancellation idempotent: stock is restored exactly once.
    const updated = await Reservation.findOneAndUpdate(
      { _id: reservation._id, status: { $in: ACTIVE_RESERVATION_STATUSES } },
      { $set: { status: 'cancelled', cancelledAt: new Date(), cancelledBy: isStaff && reservation.user.toString() !== actor.id ? 'business' : 'customer' } },
      { new: true, session },
    )
    if (!updated) throw ApiError.conflict('Rezervacija je već otkazana ili završena.', 'CANCELLATION_NOT_ALLOWED')
    onRollback(() => Reservation.updateOne({ _id: reservation._id }, { $set: { status: reservation.status }, $unset: { cancelledAt: 1, cancelledBy: 1 } }))

    await Offer.updateOne(
      { _id: reservation.offer },
      { $inc: { quantityAvailable: reservation.quantity, reservedCount: -reservation.quantity } },
      { session },
    )
    // Future: if payment.status === 'paid', trigger a refund here.
    return updated
  })

  if (cancelled.cancelledBy === 'business') {
    void notify([cancelled.user], {
      type: 'reservation_cancelled',
      title: `${business.name} je otkazao rezervaciju`,
      body: `${cancelled.quantity} × ${cancelled.offerTitle}. Izvini zbog neprijatnosti.`,
      link: `/reservations/${cancelled.id}`,
    })
  } else {
    void notify([business.owner], {
      type: 'reservation_cancelled',
      title: `Otkazana rezervacija · ${cancelled.code}`,
      body: `${cancelled.quantity} × ${cancelled.offerTitle} se vraća na stanje.`,
      link: '/business/orders',
    })
  }
  void notifyIfAvailable(cancelled.offer)

  const [dto] = await toDto([cancelled.toObject()], actor)
  return dto
}

/**
 * Hand-over at the counter. Status-guarded, so scanning the same code twice
 * can't collect twice. "Pay at pickup" reservations are recorded as paid.
 */
async function markCollected(reservation: ReservationDoc, actor: Actor) {
  const updated = await Reservation.findOneAndUpdate(
    { _id: reservation._id, status: 'confirmed' },
    {
      $set: {
        status: 'collected',
        collectedAt: new Date(),
        ...(reservation.payment.method === 'pay_at_pickup' ? { 'payment.status': 'paid' } : {}),
      },
    },
    { new: true },
  )
  if (!updated) throw collectError(await Reservation.findById(reservation._id))
  void notify([updated.user], {
    type: 'reservation_collected',
    title: 'Preuzeto – prijatno!',
    body: `${updated.offerTitle}. Kako ti se dopalo? Ostavi ocenu.`,
    link: `/reservations/${updated.id}`,
  })
  const [dto] = await toDto([updated.toObject()], actor)
  return dto
}

function collectError(r: IReservation | null) {
  switch (r?.status) {
    case 'collected':
      return ApiError.conflict('Ova rezervacija je već preuzeta.', 'ALREADY_COLLECTED')
    case 'cancelled':
      return ApiError.conflict('Ova rezervacija je otkazana.', 'RESERVATION_CANCELLED')
    case 'expired':
      return ApiError.conflict('Ova rezervacija je istekla.', 'RESERVATION_EXPIRED')
    case 'pending_payment':
      return ApiError.conflict('Rezervacija još nije plaćena.', 'PAYMENT_PENDING')
    default:
      return ApiError.notFound('Rezervacija nije pronađena.')
  }
}

/** Business marks a reservation as handed over (from its reservation list). */
export async function collect(id: string, actor: Actor) {
  const { reservation, isStaff } = await loadAuthorized(id, actor)
  if (!isStaff) throw ApiError.forbidden('Samo partner može potvrditi preuzimanje.')
  return markCollected(reservation, actor)
}

/**
 * Scan-to-collect. `reservationId` comes from the QR code (exact match);
 * typing only the short code is the fallback. Lookups are limited to the
 * caller's own businesses, so a code from another shop is simply "not found".
 */
export async function collectByCode(input: { code: string; reservationId?: string }, actor: Actor) {
  const filter: Record<string, unknown> = { code: input.code }
  if (input.reservationId) filter._id = input.reservationId
  if (!isAdmin(actor)) {
    const own = await Business.find({ owner: actor.id }).select('_id').lean()
    filter.business = { $in: own.map((b) => b._id) }
  }

  const matches = await Reservation.find(filter).sort({ pickupStart: -1 }).limit(10)
  if (matches.length === 0) throw ApiError.notFound('Kod nije pronađen u vašim lokalima.', 'CODE_NOT_FOUND')
  const collectable = matches.filter((r) => r.status === 'confirmed')
  if (collectable.length > 1) throw ApiError.conflict('Više rezervacija ima isti kod. Skenirajte QR kod.', 'AMBIGUOUS_CODE')
  if (collectable.length === 0) throw collectError(matches[0])
  return markCollected(collectable[0], actor)
}

/** Partner "Narudžbine": all reservations at the partner's locations for one local day. */
export async function listForPartner(actor: Actor, query: { start: Date; end: Date; status?: string; businessId?: string }) {
  const businesses = query.businessId
    ? [await assertBusinessAccess(query.businessId, actor)]
    : await Business.find({ owner: actor.id, deletedAt: null }).select('_id')
  const filter: Record<string, unknown> = {
    business: { $in: businesses.map((b) => b._id) },
    pickupStart: { $gte: query.start, $lt: query.end },
  }
  if (query.status === 'active') filter.status = { $in: ACTIVE_RESERVATION_STATUSES }
  else if (query.status) filter.status = query.status
  const items = await Reservation.find(filter).sort({ pickupStart: 1, createdAt: 1 }).limit(500).lean()
  return toDto(items, actor)
}

// ---------------------------------------------------------------------------
// "Send to a friend": a secret link with the pickup pass (QR + code).

/** Create (or return) the share link token for the customer's reservation. */
export async function share(id: string, actor: Actor) {
  const reservation = await Reservation.findOne({ _id: id, user: actor.id })
  if (!reservation) throw ApiError.notFound('Rezervacija nije pronađena.')
  if (!ACTIVE_RESERVATION_STATUSES.includes(reservation.status)) throw ApiError.conflict('Rezervacija više nije aktivna.', 'NOT_ACTIVE')
  if (!reservation.shareToken) {
    reservation.shareToken = randomBytes(18).toString('base64url')
    await reservation.save()
  }
  return { token: reservation.shareToken }
}

/** Public pickup pass behind the share link — only what's needed at the counter. */
export async function sharedPass(token: string) {
  const reservation = await Reservation.findOne({ shareToken: token })
  if (!reservation) throw ApiError.notFound('Link nije važeći.')
  const business = await Business.findById(reservation.business)
  if (!business) throw ApiError.notFound('Link nije važeći.')
  return {
    reservationId: reservation.id,
    code: reservation.code,
    status: reservation.status,
    quantity: reservation.quantity,
    offerTitle: reservation.offerTitle,
    totalMinor: reservation.totalMinor,
    currency: reservation.currency,
    pickupStart: reservation.pickupStart.toISOString(),
    pickupEnd: reservation.pickupEnd.toISOString(),
    timezone: reservation.timezone,
    business: {
      id: business.id,
      name: business.name,
      address: business.address,
      location: { lat: business.location.coordinates[1], lng: business.location.coordinates[0] },
      collectionInstructions: business.collectionInstructions,
      logoUrl: business.logoUrl,
    },
  }
}

/** Housekeeping: mark unclaimed reservations as expired. Run periodically. */
export async function expireStale(now = new Date()) {
  const cutoff = new Date(now.getTime() - market().expiryGraceMinutes * 60_000)
  const result = await Reservation.updateMany({ status: 'confirmed', pickupEnd: { $lt: cutoff } }, { $set: { status: 'expired' } })
  return result.modifiedCount
}
