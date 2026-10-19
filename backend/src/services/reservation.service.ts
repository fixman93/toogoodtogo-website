import { randomBytes } from 'node:crypto'
import { Types } from 'mongoose'
import { env } from '../config/env.js'
import { getMarket, marketFor } from '../config/markets.js'
import {
  ACTIVE_RESERVATION_STATUSES,
  Business,
  Offer,
  Reservation,
  Review,
  User,
  effectivePriceMinor,
  type IBusiness,
  type IReservation,
  type CollectedVia,
  type ReservationDoc,
  type DeliveryMessageKey,
  COURIER_MESSAGES,
  CUSTOMER_MESSAGES,
} from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { serializeReservation } from '../utils/serializers.js'
import { pickupCode, pickupCodeVariants } from '../utils/text.js'
import { runAtomically } from '../utils/transaction.js'
import type { CreateReservationInput, ReservationListQuery } from '../validators/reservation.validators.js'
import { distanceMeters, fromPoint } from '../utils/geo.js'
import { assertBusinessAccess, assertWorksAt, hasPermission, isAdmin, workplaceIds, worksAt, type Actor } from './access.service.js'
import { audit } from './audit.service.js'
import { notify } from './notification.service.js'
import { sendReservationTicket } from './ticket.service.js'
import * as promotions from './promotion.service.js'
import { POINTS_PER_BAG, rewardPickup, welcomeDiscountPercent } from './loyalty.service.js'

/** Shown as the "promo code" of an invited friend's first bag. */
const WELCOME_CODE = 'PREPORUKA'
import { dispatchReservationEvent } from './integration.service.js'
import { notifyIfAvailable } from './waitlist.service.js'

const market = () => getMarket(env.DEFAULT_MARKET)
type BusinessWithId = IBusiness & { _id: Types.ObjectId }
type ReservationWithId = IReservation & { _id: Types.ObjectId }

const isActive = (r: IReservation) => ACTIVE_RESERVATION_STATUSES.includes(r.status)

/** Customers can cancel until the market's cutoff before pickup; the business any time while active. */
function canCancel(r: IReservation, actor: Actor, business: BusinessWithId) {
  if (!isActive(r)) return false
  const isStaff = worksAt(business, actor)
  if (isStaff) return true
  // The courier is already on the way.
  if (r.delivery?.stage === 'on_the_way') return false
  return Date.now() < r.pickupStart.getTime() - market().cancellationCutoffMinutes * 60_000
}

export async function toDto(reservations: ReservationWithId[], actor: Actor) {
  const ids = [...new Set(reservations.map((r) => r.business.toString()))]
  const businesses = new Map((await Business.find({ _id: { $in: ids } })).map((b) => [b.id as string, b as BusinessWithId]))
  const isStaffFor = (business: BusinessWithId) => worksAt(business, actor) || hasPermission(actor, 'reservations.view')

  // Staff need the customer's name at the counter; customers never see other users.
  const staffUserIds = reservations.filter((r) => isStaffFor(businesses.get(r.business.toString())!)).map((r) => r.user)
  // Phone too: couriers call the customer at the door.
  const customers = new Map(
    (staffUserIds.length ? await User.find({ _id: { $in: staffUserIds } }).select('name phone').lean() : []).map((u) => [u._id.toString(), { name: u.name, phone: u.phone }]),
  )
  const collectedIds = reservations.filter((r) => r.status === 'collected').map((r) => r._id)
  const reviewed = new Set(
    (collectedIds.length ? await Review.find({ reservation: { $in: collectedIds } }).select('reservation').lean() : []).map((r) => r.reservation.toString()),
  )

  return reservations.map((r) => {
    const business = businesses.get(r.business.toString())!
    const customer = isStaffFor(business) ? customers.get(r.user.toString()) : undefined
    return { ...serializeReservation(r, business, canCancel(r, actor, business), customer), reviewed: reviewed.has(r._id.toString()) }
  })
}

/** Pickup code that is unique among the business's active reservations. */
async function uniquePickupCode(businessId: Types.ObjectId) {
  for (let attempt = 0; attempt < 10; attempt++) {
    const code = pickupCode()
    // Typed codes match regardless of prefix, so the 4 characters must be unique among active ones.
    const taken = await Reservation.exists({ business: businessId, code: { $in: pickupCodeVariants(code.slice(-4)) }, status: { $in: ACTIVE_RESERVATION_STATUSES } })
    if (!taken) return code
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
/** Delivery details for a new reservation, or an error when this location can't deliver there. */
async function deliveryFor(offerId: string, input: CreateReservationInput['delivery']) {
  if (!input) throw ApiError.badRequest('Upiši adresu za dostavu.', 'DELIVERY_ADDRESS_REQUIRED')
  const offer = await Offer.findById(offerId).select('business').lean()
  const business = offer && (await Business.findById(offer.business).select('delivery location').lean())
  if (!business?.delivery?.enabled) throw ApiError.badRequest('Ovaj lokal trenutno ne dostavlja.', 'DELIVERY_UNAVAILABLE')
  const to = { lat: input.lat, lng: input.lng }
  const meters = distanceMeters(fromPoint(business.location), to)
  if (meters > business.delivery.radiusKm * 1000) {
    throw ApiError.badRequest(`Adresa je van zone dostave (do ${business.delivery.radiusKm} km od lokala).`, 'OUT_OF_DELIVERY_AREA')
  }
  return {
    address: input.address,
    location: { type: 'Point' as const, coordinates: [to.lng, to.lat] as [number, number] },
    note: input.note || undefined,
    feeMinor: business.delivery.feeMinor,
    freeFromMinor: business.delivery.freeFromMinor,
    distanceMeters: meters,
    stage: 'preparing' as const,
  }
}

export async function create(input: CreateReservationInput, actor: Actor) {
  const { offerId, quantity } = input
  // Checked before touching stock: zone and fee come from the location.
  const delivery = input.fulfillment === 'delivery' ? await deliveryFor(offerId, input.delivery) : null
  // Invited by a friend: first bag discounted by the platform (unless a promo code is used).
  const welcomePercent = input.promoCode ? null : await welcomeDiscountPercent(actor.id)

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

    const unitPrice = effectivePriceMinor(offer)
    const subtotal = unitPrice * quantity
    // Optional promo code: validated, then counted atomically (respects maxUses).
    const promo = input.promoCode ? await promotions.resolve(input.promoCode, { businessId: offer.business, userId: actor.id, currency: offer.currency }) : null
    if (promo) {
      await promotions.consume(promo, session)
      onRollback(() => promotions.release(promo._id))
    }
    const discountMinor = promo
      ? promotions.discountFor(promo, subtotal)
      : welcomePercent
        ? promotions.discountFor({ discountType: 'percent', value: welcomePercent }, subtotal)
        : 0

    const [created] = await Reservation.create(
      [
        {
          user: actor.id,
          offer: offer._id,
          business: offer.business,
          code: await uniquePickupCode(offer.business),
          quantity,
          unitPriceMinor: unitPrice,
          originalUnitPriceMinor: offer.originalPriceMinor,
          totalMinor: subtotal - discountMinor,
          discountMinor,
          fulfillment: delivery ? 'delivery' : 'pickup',
          ...(delivery
            ? {
                delivery: {
                  address: delivery.address,
                  location: delivery.location,
                  note: delivery.note,
                  // Free from a threshold (on the bags' price after discount).
                  feeMinor: delivery.freeFromMinor != null && subtotal - discountMinor >= delivery.freeFromMinor ? 0 : delivery.feeMinor,
                  distanceMeters: delivery.distanceMeters,
                  stage: delivery.stage,
                },
              }
            : {}),
          ...(promo ? { promotion: promo._id, promoCode: promo.code, discountFundedBy: promo.owner ? 'partner' : 'platform' } : {}),
          ...(!promo && discountMinor > 0 ? { promoCode: WELCOME_CODE, discountFundedBy: 'platform' } : {}),
          currency: offer.currency,
          offerTitle: offer.title,
          offerImageUrl: offer.imageUrl,
          pickupStart: offer.pickupStart,
          pickupEnd: offer.pickupEnd,
          timezone: offer.timezone,
          // Secret link to the pickup pass (used in the confirmation e-mail and "send to a friend").
          shareToken: randomBytes(18).toString('base64url'),
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
  const business = await Business.findById(reservation.business).select('owner name address collectionInstructions').lean()
  void dispatchReservationEvent('reservation.created', reservation)
  // In-app + push; the e-mail is the ticket with the QR code (always sent — it's the customer's pass).
  void notify(
    [actor.id],
    {
      type: 'reservation_confirmed',
      title: `Rezervisano · ${reservation.code}`,
      body: `${reservation.quantity} × ${reservation.offerTitle}${business ? ` (${business.name})` : ''}. ${reservation.delivery ? 'Dostava na tvoju adresu – pokaži QR kod dostavljaču.' : 'Pokaži QR kod na kasi.'}`,
      link: `/reservations/${reservation.id}`,
    },
    { email: false },
  )
  if (business) {
    const customer = await User.findById(actor.id).select('email').lean()
    if (customer) void sendReservationTicket(customer.email, { ...reservation.toObject(), id: reservation.id }, business)
    // The owner and everyone working at this location (the phone at the counter).
    const staff = await User.find({ staffOf: business._id, deletedAt: null }).select('_id').lean()
    // E-mail only to those without working push on a phone (saves the daily mail quota).
    void notify(
      [business.owner, ...staff.map((s) => s._id)],
      {
        type: 'reservation_new',
        title: `${reservation.delivery ? 'Nova dostava' : 'Nova rezervacija'} · ${reservation.code}`,
        body: `${reservation.quantity} × ${reservation.offerTitle} (${business.name})${reservation.delivery ? ` → ${reservation.delivery.address}` : ''}`,
        link: '/business/orders',
      },
      { email: 'fallback' },
    )
  }
  return dto
}

export async function list(query: ReservationListQuery, actor: Actor) {
  const filter: Record<string, unknown> = {}
  if (query.businessId) {
    await assertWorksAt(query.businessId, actor)
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
  const isStaff = !!business && worksAt(business, actor)
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
    // A cancelled reservation gives the promo code use back.
    if (updated.promotion) await promotions.release(updated.promotion, session)
    // Future: if payment.status === 'paid', trigger a refund here.
    return updated
  })

  if (cancelled.cancelledBy === 'business') void flagArrivals([cancelled._id], 'arrived_cancelled')
  if (cancelled.cancelledBy === 'business') {
    void notify([cancelled.user], {
      type: 'reservation_cancelled',
      title: `${business.name} je otkazao rezervaciju`,
      body: `${cancelled.quantity} × ${cancelled.offerTitle}. Izvini zbog neprijatnosti.`,
      link: `/reservations/${cancelled.id}`,
    }, { email: 'fallback' })
  } else {
    void notify(
      [business.owner],
      {
        type: 'reservation_cancelled',
        title: `Otkazana rezervacija · ${cancelled.code}`,
        body: `${cancelled.quantity} × ${cancelled.offerTitle} se vraća na stanje.`,
        link: '/business/orders',
      },
      { email: 'fallback' },
    )
  }
  void notifyIfAvailable(cancelled.offer)
  void dispatchReservationEvent('reservation.cancelled', cancelled)

  const [dto] = await toDto([cancelled.toObject()], actor)
  return dto
}

/**
 * Hand-over at the counter. Status-guarded, so scanning the same code twice
 * can't collect twice. "Pay at pickup" reservations are recorded as paid.
 */
async function markCollected(reservation: ReservationDoc, actor: Actor, via: CollectedVia) {
  // Same default as the monthly statement (statement.service).
  const business = await Business.findById(reservation.business).select('commissionRate address.countryCode').lean()
  const commissionRate = business?.commissionRate ?? marketFor(business?.address.countryCode).commissionRate
  const updated = await Reservation.findOneAndUpdate(
    { _id: reservation._id, status: 'confirmed' },
    {
      $set: {
        status: 'collected',
        collectedAt: new Date(),
        collectedVia: via,
        commissionRate,
        ...(reservation.payment.method === 'pay_at_pickup' ? { 'payment.status': 'paid' } : {}),
        // Delivered at the door: the courier's position is no longer shared.
        ...(reservation.delivery ? { 'delivery.stage': 'delivered', 'delivery.deliveredAt': new Date() } : {}),
      },
      ...(reservation.delivery ? { $unset: { 'delivery.courierLocation': 1 } } : {}),
    },
    { new: true },
  )
  if (!updated) throw collectError(await Reservation.findById(reservation._id))
  void rewardPickup(updated.user, updated.quantity)
  void dispatchReservationEvent('reservation.collected', updated)
  void notify([updated.user], {
    type: 'reservation_collected',
    title: updated.delivery ? 'Dostavljeno – prijatno!' : 'Preuzeto – prijatno!',
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
  return markCollected(reservation, actor, 'list')
}

/**
 * Scan-to-collect. `reservationId` comes from the QR code (exact match);
 * typing only the short code is the fallback. Lookups are limited to the
 * caller's own businesses, so a code from another shop is simply "not found".
 */
export async function collectByCode(input: { code: string; reservationId?: string; via?: 'qr' | 'code' }, actor: Actor) {
  const filter: Record<string, unknown> = { code: { $in: pickupCodeVariants(input.code) } }
  if (input.reservationId) filter._id = input.reservationId
  if (!isAdmin(actor)) filter.business = { $in: await workplaceIds(actor) }

  const matches = await Reservation.find(filter).sort({ pickupStart: -1 }).limit(10)
  if (matches.length === 0) throw ApiError.notFound('Kod nije pronađen u vašim lokalima.', 'CODE_NOT_FOUND')
  const collectable = matches.filter((r) => r.status === 'confirmed')
  if (collectable.length > 1) throw ApiError.conflict('Više rezervacija ima isti kod. Skenirajte QR kod.', 'AMBIGUOUS_CODE')
  if (collectable.length === 0) throw collectError(matches[0])
  return markCollected(collectable[0], actor, input.via ?? (input.reservationId ? 'qr' : 'code'))
}

export type ScanVerdict =
  | 'valid'
  | 'early'
  | 'late'
  | 'already_collected'
  | 'cancelled'
  | 'expired'
  | 'not_paid'
  | 'not_found'
  | 'other_location'
  | 'ambiguous'

/**
 * Counter check of a scanned/typed code WITHOUT handing the bag over: is it
 * valid here and now, and if not, why. Never throws for a bad code — the
 * answer is the verdict. `early`/`late` can still be handed over.
 */
export async function verifyCode(input: { code: string; reservationId?: string }, actor: Actor) {
  const filter: Record<string, unknown> = { code: { $in: pickupCodeVariants(input.code) } }
  if (input.reservationId) filter._id = input.reservationId
  const found = await Reservation.find(filter).sort({ pickupStart: -1 }).limit(20)
  if (!found.length) return { verdict: 'not_found' as ScanVerdict }

  const mine = isAdmin(actor) ? null : new Set(await workplaceIds(actor))
  const here = mine ? found.filter((r) => mine.has(r.business.toString())) : found
  if (!here.length) {
    // Another location of the same partner: say which one; otherwise reveal nothing.
    const other = await Business.findById(found[0].business).select('name owner').lean()
    const myOwners = mine ? await Business.distinct('owner', { _id: { $in: [...mine] } }) : []
    const sameOwner = !!other && myOwners.some((o) => o.toString() === other.owner.toString())
    return { verdict: 'other_location' as ScanVerdict, businessName: sameOwner ? other!.name : undefined }
  }

  const open = here.filter((r) => r.status === 'confirmed')
  if (!input.reservationId && open.length > 1) return { verdict: 'ambiguous' as ScanVerdict }
  const r = open[0] ?? here[0]
  const now = Date.now()
  const verdict: ScanVerdict =
    r.status === 'collected'
      ? 'already_collected'
      : r.status === 'cancelled'
        ? 'cancelled'
        : r.status === 'expired'
          ? 'expired'
          : r.status === 'pending_payment'
            ? 'not_paid'
            : now < r.pickupStart.getTime()
              ? 'early'
              : now > r.pickupEnd.getTime()
                ? 'late'
                : 'valid'
  const [reservation] = await toDto([r.toObject()], actor)
  return { verdict, reservation }
}

/** Partner "Narudžbine": all reservations at the partner's locations for one local day. */
export async function listForPartner(actor: Actor, query: { start: Date; end: Date; status?: string; businessId?: string }) {
  const businessIds = query.businessId ? [(await assertWorksAt(query.businessId, actor))._id.toString()] : await workplaceIds(actor)
  const filter: Record<string, unknown> = {
    business: { $in: businessIds },
    pickupStart: { $gte: query.start, $lt: query.end },
  }
  if (query.status === 'active') filter.status = { $in: ACTIVE_RESERVATION_STATUSES }
  else if (query.status) filter.status = query.status
  const items = await Reservation.find(filter).sort({ pickupStart: 1, createdAt: 1 }).limit(500).lean()
  return toDto(items, actor)
}

// ---------------------------------------------------------------------------
// Own delivery: a staff member takes the order, their phone shares its position.

async function loadDelivery(id: string, actor: Actor) {
  const { reservation, isStaff } = await loadAuthorized(id, actor)
  if (!isStaff) throw ApiError.forbidden('Samo osoblje lokala može da dostavlja.')
  if (!reservation.delivery) throw ApiError.badRequest('Ova rezervacija nije za dostavu.', 'NOT_DELIVERY')
  if (reservation.status !== 'confirmed') throw collectError(reservation)
  return reservation
}

/** "Krećem": this staff member becomes the courier; the customer gets a push with the tracking link. */
export async function startDelivery(id: string, actor: Actor) {
  const reservation = await loadDelivery(id, actor)
  const courier = await User.findById(actor.id).select('name').lean()
  const firstStart = reservation.delivery!.stage !== 'on_the_way'
  reservation.set({
    'delivery.stage': 'on_the_way',
    'delivery.courier': actor.id,
    'delivery.courierName': courier?.name.split(/\s+/)[0],
    'delivery.startedAt': reservation.delivery!.startedAt ?? new Date(),
  })
  await reservation.save()
  if (firstStart) {
    const business = await Business.findById(reservation.business).select('name').lean()
    void notify([reservation.user], {
      type: 'delivery_started',
      title: 'Dostava je krenula',
      body: `${reservation.offerTitle}${business ? ` (${business.name})` : ''} stiže. Prati dostavljača na mapi.`,
      link: `/reservations/${reservation.id}`,
    })
  }
  const [dto] = await toDto([reservation.toObject()], actor)
  return dto
}

/** Courier: "Stigao sam" — the customer gets a push to come to the door. */
export async function courierArrived(id: string, actor: Actor) {
  const reservation = await loadDelivery(id, actor)
  if (reservation.delivery!.stage !== 'on_the_way') throw ApiError.conflict('Prvo pokreni dostavu.', 'DELIVERY_NOT_STARTED')
  const first = !reservation.delivery!.arrivedAt
  reservation.set('delivery.arrivedAt', new Date())
  await reservation.save()
  if (first) {
    void notify([reservation.user], {
      type: 'delivery_arrived',
      title: 'Dostavljač je stigao',
      body: `${reservation.delivery!.courierName ?? 'Dostavljač'} je ispred. Pripremi QR kod ${reservation.code}.`,
      link: `/reservations/${reservation.id}`,
    })
  }
  const [dto] = await toDto([reservation.toObject()], actor)
  return dto
}

const MESSAGE_TEXT: Record<DeliveryMessageKey, string> = {
  late_10: 'Kasnim oko 10 minuta.',
  cant_find: 'Ne mogu da nađem ulaz – izađi ili me pozovi.',
  calling: 'Zovem te.',
  coming_down: 'Silazim!',
  wait_5: 'Sačekaj me 5 minuta, molim te.',
  call_me: 'Pozovi me kad stigneš.',
}

/** Quick message between courier and customer (preset texts only). */
export async function deliveryMessage(id: string, key: DeliveryMessageKey, actor: Actor) {
  const { reservation, isStaff } = await loadAuthorized(id, actor)
  const d = reservation.delivery
  if (!d || reservation.status !== 'confirmed' || d.stage !== 'on_the_way') throw ApiError.conflict('Dostava nije u toku.', 'DELIVERY_NOT_ACTIVE')
  const fromCustomer = reservation.user.toString() === actor.id
  const allowed: readonly string[] = fromCustomer ? CUSTOMER_MESSAGES : COURIER_MESSAGES
  if (!allowed.includes(key) || (!fromCustomer && !isStaff)) throw ApiError.badRequest('Ova poruka nije dostupna.', 'INVALID_MESSAGE')
  if (d.messages.length >= 30) throw ApiError.conflict('Previše poruka – pozovi telefonom.', 'TOO_MANY_MESSAGES')
  reservation.delivery!.messages.push({ from: fromCustomer ? 'customer' : 'courier', key, at: new Date() })
  await reservation.save()
  const to = fromCustomer ? (d.courier ? [d.courier] : []) : [reservation.user]
  void notify(to, {
    type: 'delivery_message',
    title: fromCustomer ? `Kupac · ${reservation.code}` : `${d.courierName ?? 'Dostavljač'} · dostava`,
    body: MESSAGE_TEXT[key],
    link: fromCustomer ? `/business/deliveries/${reservation.id}` : `/reservations/${reservation.id}`,
  }, { email: false })
  const [dto] = await toDto([reservation.toObject()], actor)
  return dto
}

/** Courier's phone reports where it is (every few seconds while delivering). */
export async function updateCourierLocation(id: string, point: { lat: number; lng: number; heading?: number | null }, actor: Actor) {
  const updated = await Reservation.updateOne(
    { _id: id, status: 'confirmed', 'delivery.stage': 'on_the_way', 'delivery.courier': actor.id },
    { $set: { 'delivery.courierLocation': { lat: point.lat, lng: point.lng, heading: point.heading ?? undefined, at: new Date() } } },
  )
  if (!updated.matchedCount) {
    // Delivered, cancelled, or another staff member took over: the phone stops sending.
    throw ApiError.conflict('Dostava više nije aktivna za tebe.', 'DELIVERY_NOT_ACTIVE')
  }
  return { ok: true }
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

// ---------------------------------------------------------------------------
// Arrival check: the customer's phone at the shop during the pickup window.

/** "At the shop": within 50 m, plus up to 50 m of the phone's own GPS uncertainty. */
const NEAR_M = 50
const MAX_ACCURACY_BONUS_M = 50
/** Arrival counts this long before/after the pickup window. */
const PRESENCE_MARGIN_MS = 15 * 60_000

export async function recordPresence(id: string, point: { lat: number; lng: number; accuracy: number }, actor: Actor) {
  const reservation = await Reservation.findOne({ _id: id, user: actor.id })
  if (!reservation) throw ApiError.notFound('Rezervacija nije pronađena.')
  const now = Date.now()
  const inWindow = now >= reservation.pickupStart.getTime() - PRESENCE_MARGIN_MS && now <= reservation.pickupEnd.getTime() + PRESENCE_MARGIN_MS
  if (reservation.status !== 'confirmed' || reservation.delivery || !inWindow) return { near: false, recorded: false }
  const business = await Business.findById(reservation.business).select('location').lean()
  if (!business) return { near: false, recorded: false }
  const distance = distanceMeters(fromPoint(business.location), point)
  const near = distance <= NEAR_M + Math.min(point.accuracy, MAX_ACCURACY_BONUS_M)
  if (!near) return { near: false, recorded: false, distanceMeters: Math.round(distance) }
  const at = new Date()
  const p = reservation.presence
  reservation.set('presence', {
    firstAt: p?.firstAt ?? at,
    lastAt: at,
    minDistanceMeters: Math.min(p?.minDistanceMeters ?? Infinity, distance),
    // Accuracy of the closest reading.
    accuracyMeters: !p || distance < p.minDistanceMeters ? point.accuracy : p.accuracyMeters,
    pings: (p?.pings ?? 0) + 1,
  })
  await reservation.save()
  return { near: true, recorded: true, distanceMeters: Math.round(distance), firstAt: reservation.presence!.firstAt.toISOString() }
}

/**
 * Integrity warnings: the customer was at the shop, yet the bag wasn't
 * recorded (expired) or the partner cancelled it. The platform team is told.
 */
async function flagArrivals(ids: Types.ObjectId[], kind: 'arrived_not_scanned' | 'arrived_cancelled') {
  if (!ids.length) return
  const at = new Date()
  const flagged = await Reservation.find({ _id: { $in: ids }, 'presence.firstAt': { $exists: true }, integrityAlert: { $exists: false } }).lean()
  if (!flagged.length) return
  await Reservation.updateMany({ _id: { $in: flagged.map((r) => r._id) }, integrityAlert: { $exists: false } }, { $set: { integrityAlert: { kind, at } } })
  const names = new Map((await Business.find({ _id: { $in: flagged.map((r) => r.business) } }).select('name').lean()).map((b) => [b._id.toString(), b.name]))
  const team = await User.find({ role: { $in: ['admin', 'operations'] }, deletedAt: null }).select('_id').lean()
  for (const r of flagged) {
    void notify(
      team.map((u) => u._id),
      {
        type: 'integrity_alert',
        title: `${kind === 'arrived_cancelled' ? 'Otkazano, a kupac je bio u lokalu' : 'Kupac bio u lokalu, nije skenirano'} · ${r.code}`,
        body: `${names.get(r.business.toString()) ?? ''}: ${r.quantity} × ${r.offerTitle}. Kupac je bio ~${Math.round(r.presence!.minDistanceMeters)} m od lokala.`,
        link: '/admin?tab=integrity',
      },
      { email: false },
    )
  }
}

/** Platform: latest arrival warnings with the evidence. */
export async function integrityAlerts(actor: Actor, limit = 100) {
  const rows = await Reservation.find({ integrityAlert: { $exists: true } }).sort({ 'integrityAlert.at': -1 }).limit(limit).lean()
  return toDto(rows, actor)
}

/** Housekeeping: mark unclaimed reservations as expired. Run periodically. */
export async function expireStale(now = new Date()) {
  const cutoff = new Date(now.getTime() - market().expiryGraceMinutes * 60_000)
  // A delivery that is on its way is not "unclaimed".
  const due = await Reservation.find({ status: 'confirmed', pickupEnd: { $lt: cutoff }, 'delivery.stage': { $ne: 'on_the_way' } }).select('_id').lean()
  if (!due.length) return 0
  const ids = due.map((r) => r._id)
  const result = await Reservation.updateMany(
    { _id: { $in: ids }, status: 'confirmed' },
    { $set: { status: 'expired', 'pickupCheck.askedAt': now } },
  )
  // Customer was at the shop but nothing was recorded → integrity warning.
  await flagArrivals(ids, 'arrived_not_scanned')
  // Ask each customer whether they actually got the bag (see answerPickupCheck).
  const expired = await Reservation.find({ _id: { $in: ids }, status: 'expired', 'pickupCheck.askedAt': now }).lean()
  const names = new Map((await Business.find({ _id: { $in: expired.map((r) => r.business) } }).select('name').lean()).map((b) => [b._id.toString(), b.name]))
  for (const r of expired) {
    void notify(
      [r.user],
      {
        type: 'pickup_check',
        title: 'Da li si preuzeo/la kesu?',
        body: `${r.offerTitle} · ${names.get(r.business.toString()) ?? ''}. Ako jesi, potvrdi i dobij bodove za spašenu kesu.`,
        link: `/reservations/${r._id.toString()}`,
      },
      { email: 'fallback' },
    )
  }
  return result.modifiedCount
}

// ---------------------------------------------------------------------------
// Pickup integrity: the customer confirms pickups the partner didn't scan.

/** Customers can answer this long after the pickup window ended. */
const PICKUP_CHECK_DAYS = 7
/** Partners can dispute a customer-confirmed pickup this long after it. */
const DISPUTE_DAYS = 14

/**
 * The customer's answer to "Did you pick it up?" for an expired reservation.
 * "Yes" turns it into a pickup (commission, points, review) marked as
 * confirmed by the customer, and tells the partner it should have been scanned.
 */
export async function answerPickupCheck(id: string, answer: 'collected' | 'not_collected', actor: Actor) {
  const reservation = await Reservation.findOne({ _id: id, user: actor.id })
  if (!reservation) throw ApiError.notFound('Rezervacija nije pronađena.')
  if (reservation.pickupCheck?.answer) throw ApiError.conflict('Već si odgovorio/la.', 'ALREADY_ANSWERED')
  if (reservation.status !== 'expired') throw ApiError.conflict('Ova rezervacija nije označena kao nepreuzeta.', 'NOT_EXPIRED')
  if (Date.now() - reservation.pickupEnd.getTime() > PICKUP_CHECK_DAYS * 86_400_000) throw ApiError.conflict('Rok za potvrdu je istekao.', 'TOO_LATE')

  const now = new Date()
  if (answer === 'not_collected') {
    reservation.set({ 'pickupCheck.answer': 'not_collected', 'pickupCheck.answeredAt': now })
    await reservation.save()
    const [dto] = await toDto([reservation.toObject()], actor)
    return dto
  }

  const business = await Business.findById(reservation.business).select('owner name commissionRate address.countryCode').lean()
  const commissionRate = business?.commissionRate ?? marketFor(business?.address.countryCode).commissionRate
  const updated = await Reservation.findOneAndUpdate(
    { _id: reservation._id, status: 'expired', 'pickupCheck.answer': { $exists: false } },
    {
      $set: {
        status: 'collected',
        // Counted in the month of the pickup window, not of the answer.
        collectedAt: reservation.pickupEnd,
        collectedVia: 'customer',
        commissionRate,
        'pickupCheck.answer': 'collected',
        'pickupCheck.answeredAt': now,
        ...(reservation.payment.method === 'pay_at_pickup' ? { 'payment.status': 'paid' } : {}),
      },
    },
    { new: true },
  )
  if (!updated) throw ApiError.conflict('Već si odgovorio/la.', 'ALREADY_ANSWERED')
  void rewardPickup(updated.user, updated.quantity)
  void dispatchReservationEvent('reservation.collected', updated)
  if (business) {
    void notify([business.owner], {
      type: 'pickup_confirmed_by_customer',
      title: `Kupac je potvrdio preuzimanje · ${updated.code}`,
      body: `${updated.quantity} × ${updated.offerTitle} (${business.name}) nije skenirano, a kupac kaže da je preuzeto. Uračunato je u obračun – uvek skeniraj QR kod.`,
      link: '/business/pickups',
    }, { email: 'fallback' })
  }
  const [dto] = await toDto([updated.toObject()], actor)
  return dto
}

/** The partner (owner) says a customer-confirmed pickup didn't happen; the platform team decides. */
export async function openDispute(id: string, reason: string, actor: Actor) {
  const reservation = await Reservation.findById(id)
  if (!reservation) throw ApiError.notFound('Rezervacija nije pronađena.')
  const business = await assertBusinessAccess(reservation.business, actor)
  if (reservation.collectedVia !== 'customer' || reservation.status !== 'collected') {
    throw ApiError.conflict('Osporiti se može samo preuzimanje koje je potvrdio kupac.', 'NOT_DISPUTABLE')
  }
  if (reservation.dispute) throw ApiError.conflict('Ovo preuzimanje je već osporeno.', 'ALREADY_DISPUTED')
  if (Date.now() - (reservation.pickupCheck?.answeredAt ?? reservation.pickupEnd).getTime() > DISPUTE_DAYS * 86_400_000) {
    throw ApiError.conflict('Rok za osporavanje je istekao.', 'TOO_LATE')
  }
  reservation.dispute = { status: 'open', reason, openedAt: new Date(), openedBy: new Types.ObjectId(actor.id) }
  await reservation.save()
  const team = await User.find({ role: { $in: ['admin', 'operations'] }, deletedAt: null }).select('_id').lean()
  void notify(
    team.map((u) => u._id),
    { type: 'pickup_dispute', title: `Osporeno preuzimanje · ${reservation.code}`, body: `${business.name}: ${reason}`, link: '/admin?tab=integrity' },
    { email: false },
  )
  const [dto] = await toDto([reservation.toObject()], actor)
  return dto
}

/**
 * Platform decision on a dispute. Upheld → back to "not collected" (no
 * commission; the customer's points for it are taken back). Rejected → stays
 * a pickup.
 */
export async function resolveDispute(id: string, decision: 'upheld' | 'rejected', note: string | undefined, actor: Actor) {
  const reservation = await Reservation.findOne({ _id: id, 'dispute.status': 'open' })
  if (!reservation) throw ApiError.notFound('Otvoren spor nije pronađen.')
  const now = new Date()
  reservation.set({ 'dispute.status': decision, 'dispute.resolvedAt': now, 'dispute.resolvedBy': actor.id, 'dispute.note': note })
  if (decision === 'upheld') {
    reservation.set({ status: 'expired', collectedAt: undefined, commissionRate: undefined })
    await User.updateOne({ _id: reservation.user }, [{ $set: { points: { $max: [0, { $subtract: ['$points', reservation.quantity * POINTS_PER_BAG] }] } } }])
  }
  await reservation.save()
  const business = await Business.findById(reservation.business).select('owner name').lean()
  if (business) {
    void notify([business.owner], {
      type: 'pickup_dispute',
      title: decision === 'upheld' ? `Spor prihvaćen · ${reservation.code}` : `Spor odbijen · ${reservation.code}`,
      body: decision === 'upheld' ? 'Rezervacija se vodi kao nepreuzeta i ne ulazi u obračun.' : `Preuzimanje ostaje u obračunu.${note ? ` ${note}` : ''}`,
      link: '/business/pickups',
    }, { email: 'fallback' })
  }
  void audit(actor, {
    action: `dispute.${decision}`,
    targetType: 'business',
    targetId: reservation.business,
    summary: `${decision === 'upheld' ? 'Prihvaćen' : 'Odbijen'} spor ${reservation.code}${business ? ` (${business.name})` : ''}`,
  })
  const [dto] = await toDto([reservation.toObject()], actor)
  return dto
}
