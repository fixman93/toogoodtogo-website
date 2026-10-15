/**
 * Map Mongoose documents to the public API shape (see src/api/types.ts in the
 * frontend). Keeps internal fields (password hashes, denormalized helpers,
 * GeoJSON ordering) out of responses.
 */
import type { Types } from 'mongoose'
import type { IBusiness, IFavorite, IOffer, IReservation, IReview, IUser } from '../models/index.js'

type WithId<T> = T & { _id: Types.ObjectId }

export function serializeUser(u: WithId<IUser>) {
  return {
    id: u._id.toString(),
    name: u.name,
    email: u.email,
    role: u.role,
    locale: u.locale,
    countryCode: u.countryCode,
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
  }
}

export function serializeBusiness(b: WithId<IBusiness>) {
  return {
    ...serializeBusinessSummary(b),
    slug: b.slug,
    description: b.description,
    collectionInstructions: b.collectionInstructions,
    phone: b.phone,
    currency: b.currency,
    ownerId: b.owner.toString(),
    isActive: b.isActive,
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
    imageUrl: o.imageUrl ?? business.coverUrl,
    tags: o.tags,
    priceMinor: o.priceMinor,
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
    ...(o.distanceMeters != null ? { distanceMeters: Math.round(o.distanceMeters) } : {}),
  }
}

export function serializeReservation(r: WithId<IReservation>, business: WithId<IBusiness>, canCancel: boolean, customerName?: string) {
  return {
    id: r._id.toString(),
    code: r.code,
    status: r.status,
    quantity: r.quantity,
    unitPriceMinor: r.unitPriceMinor,
    originalUnitPriceMinor: r.originalUnitPriceMinor,
    totalMinor: r.totalMinor,
    currency: r.currency,
    pickupStart: r.pickupStart.toISOString(),
    pickupEnd: r.pickupEnd.toISOString(),
    timezone: r.timezone,
    offer: { id: r.offer.toString(), title: r.offerTitle, imageUrl: r.offerImageUrl },
    business: serializeBusinessSummary(business),
    payment: { status: r.payment.status, method: r.payment.method },
    canCancel,
    ...(customerName ? { customer: { name: customerName } } : {}),
    cancelledAt: r.cancelledAt?.toISOString(),
    collectedAt: r.collectedAt?.toISOString(),
    createdAt: r.createdAt.toISOString(),
  }
}

export function serializeReview(
  r: Pick<WithId<IReview>, '_id' | 'rating' | 'comment' | 'createdAt'>,
  user: { _id: Types.ObjectId; name: string } | null,
) {
  return {
    id: r._id.toString(),
    rating: r.rating,
    comment: r.comment,
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
