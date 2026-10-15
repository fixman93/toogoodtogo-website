import { Business, Favorite, Offer } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { serializeBusinessSummary, serializeFavoriteBase, serializeOffer } from '../utils/serializers.js'
import type { Actor } from './access.service.js'

type FavoriteDto = ReturnType<typeof serializeFavoriteBase> & {
  business?: ReturnType<typeof serializeBusinessSummary> & { activeOfferCount: number }
  offer?: ReturnType<typeof serializeOffer>
}

export async function list(actor: Actor) {
  const favorites = await Favorite.find({ user: actor.id }).sort({ createdAt: -1 }).lean()
  const businessIds = favorites.filter((f) => f.targetType === 'business').map((f) => f.targetId)
  const offerIds = favorites.filter((f) => f.targetType === 'offer').map((f) => f.targetId)

  const [businesses, offers, activeCounts] = await Promise.all([
    Business.find({ _id: { $in: businessIds }, isActive: true }).lean(),
    Offer.find({ _id: { $in: offerIds }, status: { $ne: 'archived' } }).lean(),
    Offer.aggregate<{ _id: unknown; count: number }>([
      { $match: { business: { $in: businessIds }, status: 'active', pickupEnd: { $gt: new Date() }, quantityAvailable: { $gt: 0 } } },
      { $group: { _id: '$business', count: { $sum: 1 } } },
    ]),
  ])
  const offerBusinesses = await Business.find({ _id: { $in: offers.map((o) => o.business) } }).lean()

  const businessById = new Map([...businesses, ...offerBusinesses].map((b) => [b._id.toString(), b]))
  const activeBusinessById = new Map(businesses.map((b) => [b._id.toString(), b]))
  const offerById = new Map(offers.map((o) => [o._id.toString(), o]))
  const countById = new Map(activeCounts.map((c) => [String(c._id), c.count]))

  // Silently skip favorites whose target was removed or deactivated.
  const items = favorites.flatMap((f): FavoriteDto[] => {
    const id = f.targetId.toString()
    if (f.targetType === 'business') {
      const business = activeBusinessById.get(id)
      return business
        ? [{ ...serializeFavoriteBase(f), business: { ...serializeBusinessSummary(business), activeOfferCount: countById.get(id) ?? 0 } }]
        : []
    }
    const offer = offerById.get(id)
    const business = offer && businessById.get(offer.business.toString())
    return offer && business ? [{ ...serializeFavoriteBase(f), offer: serializeOffer(offer, business) }] : []
  })
  return { items, meta: { page: 1, limit: items.length, total: items.length } }
}

export async function add(input: { targetType: 'business' | 'offer'; targetId: string }, actor: Actor) {
  const exists = input.targetType === 'business' ? await Business.exists({ _id: input.targetId }) : await Offer.exists({ _id: input.targetId })
  if (!exists) throw ApiError.notFound('Ne postoji.')

  const existing = await Favorite.findOne({ user: actor.id, ...input })
  if (existing) return { created: false, favorite: serializeFavoriteBase(existing) }
  try {
    const favorite = await Favorite.create({ user: actor.id, ...input })
    return { created: true, favorite: serializeFavoriteBase(favorite) }
  } catch (error) {
    // Concurrent double-tap: the unique index already holds it.
    if ((error as { code?: number }).code === 11000) {
      const favorite = await Favorite.findOne({ user: actor.id, ...input })
      if (favorite) return { created: false, favorite: serializeFavoriteBase(favorite) }
    }
    throw error
  }
}

export async function remove(id: string, actor: Actor) {
  const result = await Favorite.deleteOne({ _id: id, user: actor.id })
  if (result.deletedCount === 0) throw ApiError.notFound('Omiljeno nije pronađeno.')
}
