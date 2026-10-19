/**
 * Map Mongoose documents to the public API shape (see src/api/types.ts in the
 * frontend). Keeps internal fields (password hashes, denormalized helpers,
 * GeoJSON ordering) out of responses.
 */
import type { Types } from 'mongoose'
import { permissionsFor } from '../config/permissions.js'
import { effectivePriceMinor, type IBusiness, type IFavorite, type IOffer, type IReservation, type IReview, type IUser } from '../models/index.js'

type WithId<T> = T & { _id: Types.ObjectId }

export function serializeUser(u: WithId<IUser>) {
  return {
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    role: u.role,
    locale: u.locale,
    countryCode: u.countryCode,
    avatarUrl: u.avatarUrl,
    phone: u.phone ?? null,
    /** Partner locations a staff member works at. */
    staffOf: (u.staffOf ?? []).map(String),
    /** Platform permissions (admin panel), see config/permissions. */
    permissions: permissionsFor(u.role),
    notificationPrefs: { push: u.notificationPrefs?.push ?? true, email: u.notificationPrefs?.email ?? true },
    createdAt: u.createdAt.toISOString(),
  }
}

export function serializeBusinessSummary(b: WithId<IBusiness>) {
  return {
    id: b._id.toString(),
    name: b.name,
    category: b.category,
    logoUrl: b.logoUrl,
    coverUrl: b.coverUrl,
    address: b.address,
    location: { lat: b.location.coordinates[1], lng: b.location.coordinates[0] },
    timezone: b.timezone,
    rating: { average: Math.round(b.rating.average * 10) / 10, count: b.rating.count },
    // Customers only see delivery that is switched on.
    delivery: b.delivery?.enabled ? serializeDelivery(b.delivery) : null,
  }
}

function serializeDelivery(d: NonNullable<IBusiness['delivery']>) {
  return { enabled: d.enabled, feeMinor: d.feeMinor, radiusKm: d.radiusKm, freeFromMinor: d.freeFromMinor ?? null }
}

export function serializeBusiness(b: WithId<IBusiness>) {
  return {
    ...serializeBusinessSummary(b),
    slug: b.slug,
    description: b.description,
    collectionInstructions: b.collectionInstructions,
    openingHours: b.openingHours,
    createdAt: b.createdAt.toISOString(),
    phone: b.phone,
    currency: b.currency,
    ownerId: b.owner.toString(),
    isActive: b.isActive,
    // The owner's form needs the settings even while delivery is off.
    delivery: b.delivery ? serializeDelivery(b.delivery) : null,
  }
}

export function serializeOffer(o: WithId<IOffer> & { distanceMeters?: number }, business: WithId<IBusiness>) {
  return {
    id: o._id.toString(),
    businessId: business._id.toString(),
    business: serializeBusinessSummary(business),
    title: o.title,
    description: o.description,
    category: o.category,
    imageUrl: o.imageUrl || business.coverUrl,
    tags: o.tags,
    contentType: o.contentType ?? 'surprise',
    contents: o.contents ?? [],
    allergens: o.allergens ?? [],
    // Price that applies right now; basePriceMinor/priceDrop describe dynamic pricing.
    priceMinor: effectivePriceMinor(o),
    basePriceMinor: o.priceMinor,
    ...(o.priceDrop ? { priceDrop: { at: o.priceDrop.at.toISOString(), priceMinor: o.priceDrop.priceMinor } } : {}),
    originalPriceMinor: o.originalPriceMinor,
    currency: o.currency,
    quantityTotal: o.quantityTotal,
    quantityAvailable: o.quantityAvailable,
    maxPerReservation: o.maxPerReservation,
    pickupStart: o.pickupStart.toISOString(),
    pickupEnd: o.pickupEnd.toISOString(),
    timezone: o.timezone,
    status: o.pickupEnd.getTime() < Date.now() ? 'expired' : o.status,
    reservedCount: o.reservedCount,
    boosted: !!o.boostedUntil && o.boostedUntil > new Date(),
    ...(o.schedule ? { scheduleId: o.schedule.toString() } : {}),
    ...(o.distanceMeters != null ? { distanceMeters: Math.round(o.distanceMeters) } : {}),
  }
}

export function serializeReservation(r: WithId<IReservation>, business: WithId<IBusiness>, canCancel: boolean, customer?: { name: string; phone?: string }) {
  const d = r.delivery
  return {
    id: r._id.toString(),
    code: r.code,
    status: r.status,
    quantity: r.quantity,
    unitPriceMinor: r.unitPriceMinor,
    originalUnitPriceMinor: r.originalUnitPriceMinor,
    totalMinor: r.totalMinor,
    discountMinor: r.discountMinor ?? 0,
    ...(r.promoCode ? { promoCode: r.promoCode } : {}),
    currency: r.currency,
    pickupStart: r.pickupStart.toISOString(),
    pickupEnd: r.pickupEnd.toISOString(),
    timezone: r.timezone,
    offer: { id: r.offer.toString(), title: r.offerTitle, imageUrl: r.offerImageUrl || business.coverUrl },
    business: serializeBusinessSummary(business),
    payment: { status: r.payment.status, method: r.payment.method },
    canCancel,
    ...(customer ? { customer: { name: customer.name, ...(customer.phone ? { phone: customer.phone } : {}) } } : {}),
    fulfillment: r.fulfillment ?? 'pickup',
    delivery: d
      ? {
          address: d.address,
          location: { lat: d.location.coordinates[1], lng: d.location.coordinates[0] },
          note: d.note ?? null,
          feeMinor: d.feeMinor,
          distanceMeters: Math.round(d.distanceMeters),
          stage: d.stage,
          courierName: d.courierName ?? null,
          startedAt: d.startedAt?.toISOString() ?? null,
          deliveredAt: d.deliveredAt?.toISOString() ?? null,
          arrivedAt: d.arrivedAt?.toISOString() ?? null,
          messages: (d.messages ?? []).slice(-10).map((m) => ({ from: m.from, key: m.key, at: m.at.toISOString() })),
          courierLocation:
            d.stage === 'on_the_way' && d.courierLocation?.at
              ? { lat: d.courierLocation.lat, lng: d.courierLocation.lng, heading: d.courierLocation.heading ?? null, at: d.courierLocation.at.toISOString() }
              : null,
        }
      : null,
    /** What the customer pays at the door / counter: bags + delivery. */
    amountDueMinor: r.totalMinor + (d?.feeMinor ?? 0),
    cancelledAt: r.cancelledAt?.toISOString(),
    collectedAt: r.collectedAt?.toISOString(),
    collectedVia: r.collectedVia ?? null,
    pickupCheck: r.pickupCheck?.askedAt ? { askedAt: r.pickupCheck.askedAt.toISOString(), answer: r.pickupCheck.answer ?? null } : null,
    dispute: r.dispute ? { status: r.dispute.status, reason: r.dispute.reason, openedAt: r.dispute.openedAt.toISOString(), note: r.dispute.note ?? null } : null,
    createdAt: r.createdAt.toISOString(),
  }
}

export function serializeReview(
  r: Pick<WithId<IReview>, '_id' | 'rating' | 'comment' | 'createdAt'> & { photos?: string[] },
  user: { _id: Types.ObjectId; name: string } | null,
) {
  return {
    id: r._id.toString(),
    rating: r.rating,
    comment: r.comment,
    photos: r.photos ?? [],
    // Show first name + initial only, for privacy.
    user: { id: user?._id.toString() ?? '', name: user ? shortName(user.name) : 'Korisnik' },
    createdAt: r.createdAt.toISOString(),
  }
}

export function serializeFavoriteBase(f: WithId<IFavorite>) {
  return { id: f._id.toString(), targetType: f.targetType, targetId: f.targetId.toString(), createdAt: f.createdAt.toISOString() }
}

function shortName(name: string) {
  const [first, last] = name.trim().split(/\s+/)
  return last ? `${first} ${last[0]}.` : first
}
