import { randomBytes } from 'node:crypto'
import { env } from '../config/env.js'
import { MARKETS, getMarket } from '../config/markets.js'
import { ACTIVE_RESERVATION_STATUSES, Business, Favorite, Offer, Reservation, Review } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { serializeBusiness } from '../utils/serializers.js'
import { escapeRegex, slugify } from '../utils/text.js'
import type { CreateBusinessInput, UpdateBusinessInput } from '../validators/business.validators.js'
import { assertBusinessAccess, hasPermission, isAdmin, type Actor } from './access.service.js'
import { audit } from './audit.service.js'
import { deleteIfOwned } from './storage.service.js'

const toPoint = ({ lat, lng }: { lat: number; lng: number }) => ({ type: 'Point' as const, coordinates: [lng, lat] as [number, number] })

export async function list(
  query: { owner?: 'me'; city?: string; category?: string; sort: 'name' | 'new'; page: number; limit: number },
  actor?: Actor,
) {
  // `deletedAt: null` also matches documents without the field.
  const filter: Record<string, unknown> = { deletedAt: null }
  if (query.owner === 'me') {
    if (!actor) throw ApiError.unauthorized()
    filter.owner = actor.id
  } else {
    filter.isActive = true
  }
  if (query.city) filter['address.city'] = new RegExp(`^${escapeRegex(query.city)}$`, 'i')
  if (query.category) filter.category = query.category

  const [items, total] = await Promise.all([
    Business.find(filter).sort(query.sort === 'new' ? { createdAt: -1 } : { name: 1 }).skip((query.page - 1) * query.limit).limit(query.limit),
    Business.countDocuments(filter),
  ])
  return { items: items.map(serializeBusiness), meta: { page: query.page, limit: query.limit, total } }
}

export async function get(id: string, actor?: Actor) {
  const business = await Business.findById(id)
  const canSeeInactive = actor && (isAdmin(actor) || hasPermission(actor, 'businesses.moderate') || business?.owner.toString() === actor.id)
  if (!business || business.deletedAt || (!business.isActive && !canSeeInactive)) throw ApiError.notFound('Lokal nije pronađen.')
  return serializeBusiness(business)
}

export async function create(input: CreateBusinessInput, actor: Actor) {
  const market = MARKETS[input.address.countryCode] ?? getMarket(env.DEFAULT_MARKET)
  const business = await Business.create({
    ...input,
    owner: actor.id,
    slug: `${slugify(input.name)}-${randomBytes(3).toString('hex')}`,
    location: toPoint(input.location),
    timezone: input.timezone ?? market.timezone,
    currency: input.currency ?? market.currency,
  })
  return serializeBusiness(business)
}

export async function update(id: string, input: UpdateBusinessInput, actor: Actor) {
  // Moderators (operations) may only switch a location on/off; everything else is owner-only.
  const moderationOnly = Object.keys(input).every((k) => k === 'isActive') && hasPermission(actor, 'businesses.moderate')
  const business = moderationOnly ? await Business.findOne({ _id: id, deletedAt: null }) : await assertBusinessAccess(id, actor)
  if (!business) throw ApiError.notFound('Lokal nije pronađen.')
  const { location, address, ...rest } = input
  const oldImages = { logoUrl: business.logoUrl, coverUrl: business.coverUrl }
  business.set(rest)
  if (address) business.set('address', address)
  if (location) business.location = toPoint(location)
  await business.save()
  // Offers that stored a copy of the old cover follow the new one (they fall back to the cover).
  if (input.coverUrl !== undefined && oldImages.coverUrl && oldImages.coverUrl !== business.coverUrl) {
    await Offer.updateMany({ business: business._id, imageUrl: oldImages.coverUrl }, { $unset: { imageUrl: 1 } })
    await Reservation.updateMany({ business: business._id, offerImageUrl: oldImages.coverUrl }, { $unset: { offerImageUrl: 1 } })
  }
  for (const field of ['logoUrl', 'coverUrl'] as const) {
    if (input[field] !== undefined && oldImages[field] && oldImages[field] !== business[field]) void deleteIfOwned(oldImages[field])
  }

  // Keep denormalized offer fields in sync; deactivating a business pauses its offers.
  await Offer.updateMany(
    { business: business._id },
    { $set: { businessName: business.name, city: business.address.city, location: business.location, timezone: business.timezone } },
  )
  if (input.isActive === false) await Offer.updateMany({ business: business._id, status: 'active' }, { $set: { status: 'paused' } })
  if (business.owner.toString() !== actor.id && input.isActive != null) {
    void audit(actor, {
      action: input.isActive ? 'business.activate' : 'business.deactivate',
      targetType: 'business',
      targetId: business._id,
      summary: `${input.isActive ? 'Uključena' : 'Isključena'} lokacija: ${business.name}`,
    })
  }

  return serializeBusiness(business)
}

/**
 * Delete a location. Refused while customers still have bags to collect.
 * A location with history (past reservations or reviews) is soft-deleted so
 * customers keep their reservation history; otherwise it is removed entirely
 * together with its offers.
 */
export async function remove(id: string, actor: Actor) {
  const business = await assertBusinessAccess(id, actor)
  if (await Reservation.exists({ business: business._id, status: { $in: ACTIVE_RESERVATION_STATUSES } })) {
    throw ApiError.conflict('Lokacija ima aktivne rezervacije. Sačekaj da ih kupci preuzmu ili ih otkaži, pa pokušaj ponovo.', 'HAS_ACTIVE_RESERVATIONS')
  }

  await Favorite.deleteMany({ targetType: 'business', targetId: business._id })
  const hasHistory = (await Reservation.exists({ business: business._id })) || (await Review.exists({ business: business._id }))
  if (hasHistory) {
    await Offer.updateMany({ business: business._id }, { $set: { status: 'archived' } })
    business.isActive = false
    business.deletedAt = new Date()
    await business.save()
  } else {
    await Offer.deleteMany({ business: business._id })
    await business.deleteOne()
    // Nothing references this location anymore: remove its images too.
    void deleteIfOwned(business.logoUrl)
    void deleteIfOwned(business.coverUrl)
  }
}
