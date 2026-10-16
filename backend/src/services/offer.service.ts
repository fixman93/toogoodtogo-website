import { Types, type PipelineStage } from 'mongoose'
import { env } from '../config/env.js'
import { MARKETS, getMarket } from '../config/markets.js'
import { Business, Favorite, Offer, Reservation, ACTIVE_RESERVATION_STATUSES, effectivePriceExpr, type IBusiness, type IOffer } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { serializeOffer } from '../utils/serializers.js'
import { escapeRegex } from '../utils/text.js'
import { zonedTime } from '../utils/time.js'
import type { CreateOfferInput, OfferFilters, OfferListQuery, OfferLocationsQuery, UpdateOfferInput } from '../validators/offer.validators.js'
import { assertBusinessAccess, type Actor } from './access.service.js'
import { notify } from './notification.service.js'
import { notifyIfAvailable } from './waitlist.service.js'
import { deleteIfOwned } from './storage.service.js'
import { assertNotSuspended } from './partner-moderation.service.js'

type OfferWithBusiness = IOffer & { _id: Types.ObjectId; distanceMeters?: number; businessDoc: IBusiness & { _id: Types.ObjectId } }

/** Local-hour ranges (in the offer's own timezone). */
const TIME_OF_DAY = { morning: [0, 12], afternoon: [12, 17], evening: [17, 24] } as const

/** Live offers matching the customer-facing filters (list and map). */
function liveOfferMatch(query: OfferFilters, now = new Date()) {
  const market = getMarket(env.DEFAULT_MARKET)
  const match: Record<string, unknown> = { status: 'active', pickupEnd: { $gt: now } }

  if (query.category) match.category = query.category
  // A max price only compares offers in the same currency.
  if (query.maxPriceMinor && query.currency) match.currency = query.currency
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), 'i')
    match.$or = [{ title: rx }, { businessName: rx }, { city: rx }]
  }
  if (query.pickupDay) {
    const offset = query.pickupDay === 'today' ? 0 : 1
    match.pickupStart = { $gte: zonedTime(offset, '00:00', market.timezone, now), $lt: zonedTime(offset + 1, '00:00', market.timezone, now) }
  }
  if (query.timeOfDay) {
    const [from, to] = TIME_OF_DAY[query.timeOfDay]
    const hour = { $hour: { date: '$pickupStart', timezone: '$timezone' } }
    match.$expr = { $and: [{ $gte: [hour, from] }, { $lt: [hour, to] }] }
  }
  return match
}

export async function list(query: OfferListQuery) {
  const match = liveOfferMatch(query)
  if (query.businessId) match.business = new Types.ObjectId(query.businessId)

  const hasOrigin = query.lat != null && query.lng != null
  const pipeline: PipelineStage[] = hasOrigin
    ? [
        {
          $geoNear: {
            near: { type: 'Point', coordinates: [query.lng!, query.lat!] },
            distanceField: 'distanceMeters',
            spherical: true,
            query: match,
            ...(query.maxDistanceKm ? { maxDistance: query.maxDistanceKm * 1000 } : {}),
          },
        },
      ]
    : [{ $match: match }]

  // Dynamic pricing: filter and sort on the price that applies right now.
  pipeline.push({ $addFields: { effectivePrice: effectivePriceExpr() } })
  if (query.maxPriceMinor) pipeline.push({ $match: { effectivePrice: { $lte: query.maxPriceMinor } } })

  const sort = query.sort ?? (hasOrigin ? 'distance' : 'pickup')
  const sortStage: Record<string, 1 | -1> = { soldOut: 1 }
  if (sort === 'distance' && hasOrigin) sortStage.distanceMeters = 1
  else if (sort === 'price') sortStage.effectivePrice = 1
  else if (sort === 'popularity') sortStage.reservedCount = -1
  else if (sort === 'rating') sortStage['rating'] = -1
  sortStage.pickupStart = 1
  sortStage._id = 1

  if (sort === 'rating') {
    // Rating lives on the business: join it before sorting (unrated last).
    pipeline.push(
      { $lookup: { from: 'businesses', localField: 'business', foreignField: '_id', as: 'ratingDoc', pipeline: [{ $project: { rating: 1 } }] } },
      {
        $addFields: {
          rating: {
            $cond: [{ $gt: [{ $first: '$ratingDoc.rating.count' }, 0] }, { $first: '$ratingDoc.rating.average' }, -1],
          },
        },
      },
    )
  }

  pipeline.push(
    { $addFields: { soldOut: { $eq: ['$quantityAvailable', 0] } } },
    { $sort: sortStage },
    {
      $facet: {
        items: [
          { $skip: (query.page - 1) * query.limit },
          { $limit: query.limit },
          { $lookup: { from: 'businesses', localField: 'business', foreignField: '_id', as: 'businessDoc' } },
          { $unwind: '$businessDoc' },
        ],
        total: [{ $count: 'count' }],
      },
    },
  )

  const [result] = await Offer.aggregate<{ items: OfferWithBusiness[]; total: { count: number }[] }>(pipeline)
  return {
    items: result.items.map((o) => serializeOffer(o, o.businessDoc)),
    meta: { page: query.page, limit: query.limit, total: result.total[0]?.count ?? 0 },
  }
}

/**
 * Partner view of one location's offers: includes paused and past offers
 * (the public list only shows live ones). Newest pickup first.
 */
export async function listForBusiness(businessId: string, actor: Actor, page: number, limit: number) {
  const business = await assertBusinessAccess(businessId, actor)
  const filter = { business: business._id, status: { $ne: 'archived' } }
  const [items, total] = await Promise.all([
    Offer.find(filter).sort({ pickupStart: -1 }).skip((page - 1) * limit).limit(limit),
    Offer.countDocuments(filter),
  ])
  return { items: items.map((o) => serializeOffer(o, business)), meta: { page, limit, total } }
}

/**
 * Map pins: every location with live offers inside the bounding box, one
 * entry per location (cheap even when zoomed out to a whole country).
 */
export async function locations(query: OfferLocationsQuery) {
  const match = liveOfferMatch(query)
  // A GeoJSON polygon must stay below a hemisphere; very wide boxes just skip the geo filter.
  if (query.maxLng - query.minLng < 180) {
    const { minLat, maxLat, minLng, maxLng } = query
    match.location = {
      $geoWithin: {
        $geometry: {
          type: 'Polygon',
          coordinates: [[[minLng, minLat], [maxLng, minLat], [maxLng, maxLat], [minLng, maxLat], [minLng, minLat]]],
        },
      },
    }
  }

  const rows = await Offer.aggregate<{
    _id: Types.ObjectId
    name: string
    category: string
    location: { coordinates: [number, number] }
    currency: string
    offerCount: number
    availableBags: number
    minPriceMinor: number | null
  }>([
    { $match: match },
    { $addFields: { effectivePrice: effectivePriceExpr() } },
    ...(query.maxPriceMinor ? [{ $match: { effectivePrice: { $lte: query.maxPriceMinor } } }] : []),
    {
      $group: {
        _id: '$business',
        name: { $first: '$businessName' },
        category: { $first: '$category' },
        location: { $first: '$location' },
        currency: { $first: '$currency' },
        offerCount: { $sum: 1 },
        availableBags: { $sum: '$quantityAvailable' },
        // $min ignores nulls: cheapest offer that still has bags.
        minPriceMinor: { $min: { $cond: [{ $gt: ['$quantityAvailable', 0] }, '$effectivePrice', null] } },
      },
    },
    { $limit: 2000 },
  ])

  return rows.map((r) => ({
    businessId: r._id.toString(),
    name: r.name,
    category: r.category,
    location: { lat: r.location.coordinates[1], lng: r.location.coordinates[0] },
    currency: r.currency,
    offerCount: r.offerCount,
    availableBags: r.availableBags,
    minPriceMinor: r.minPriceMinor,
  }))
}

export async function get(id: string) {
  const offer = await Offer.findById(id)
  if (!offer || offer.status === 'archived') throw ApiError.notFound('Ponuda nije pronađena.')
  const business = await Business.findById(offer.business)
  if (!business) throw ApiError.notFound('Ponuda nije pronađena.')
  return serializeOffer(offer, business)
}

export async function create(input: CreateOfferInput, actor: Actor) {
  const business = await assertBusinessAccess(input.businessId, actor)
  await assertNotSuspended(business)
  if (!business.isActive) throw ApiError.conflict('Lokal nije aktivan.', 'BUSINESS_INACTIVE')
  if (input.pickupEnd <= new Date()) throw ApiError.badRequest('Vreme preuzimanja mora biti u budućnosti.', 'PICKUP_IN_PAST')
  if (input.priceDrop && input.priceDrop.priceMinor >= input.priceMinor) {
    throw ApiError.badRequest('Sniženje mora biti niže od osnovne cene.', 'INVALID_PRICE_DROP')
  }

  const market = MARKETS[business.address.countryCode] ?? getMarket(env.DEFAULT_MARKET)
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { businessId, ...fields } = input
  const offer = await Offer.create({
    ...fields,
    business: business._id,
    category: input.category ?? business.category,
    currency: business.currency,
    timezone: business.timezone,
    quantityAvailable: input.quantityTotal,
    maxPerReservation: Math.min(input.maxPerReservation ?? market.maxQuantityPerReservation, input.quantityTotal),
    location: business.location,
    businessName: business.name,
    city: business.address.city,
  })

  // Tell everyone who follows this location (favorites).
  const followers = await Favorite.find({ targetType: 'business', targetId: business._id }).select('user').lean()
  void notify(
    followers.map((f) => f.user),
    { type: 'offer_new', title: `Nova ponuda: ${business.name}`, body: offer.title, link: `/offers/${offer.id}` },
  )
  return serializeOffer(offer, business)
}

export async function update(id: string, input: UpdateOfferInput, actor: Actor) {
  const offer = await Offer.findById(id)
  if (!offer || offer.status === 'archived') throw ApiError.notFound('Ponuda nije pronađena.')
  const business = await assertBusinessAccess(offer.business, actor)
  if (input.status === 'active') await assertNotSuspended(business)

  const merged = { ...offer.toObject(), ...input }
  if (merged.priceMinor >= merged.originalPriceMinor) throw ApiError.badRequest('Cena mora biti niža od redovne.', 'INVALID_PRICE')
  if (merged.priceDrop && merged.priceDrop.priceMinor >= merged.priceMinor) {
    throw ApiError.badRequest('Sniženje mora biti niže od osnovne cene.', 'INVALID_PRICE_DROP')
  }
  if (merged.pickupEnd <= merged.pickupStart) throw ApiError.badRequest('Kraj preuzimanja mora biti posle početka.', 'INVALID_PICKUP')
  if ((input.pickupEnd || input.status === 'active') && merged.pickupEnd <= new Date()) {
    throw ApiError.badRequest('Vreme preuzimanja mora biti u budućnosti.', 'PICKUP_IN_PAST')
  }

  const { quantityTotal, priceDrop, ...fields } = input
  const filter: Record<string, unknown> = { _id: offer._id }
  const change: { $set: Record<string, unknown>; $inc?: Record<string, number>; $unset?: Record<string, 1> } = { $set: fields }
  if (priceDrop === null) change.$unset = { priceDrop: 1 }
  else if (priceDrop) change.$set.priceDrop = priceDrop
  // The partner decided this offer's state themselves: reactivating the partner mustn't override it.
  if (input.status) change.$unset = { ...change.$unset, pausedByAdmin: 1 }

  if (quantityTotal != null && quantityTotal !== offer.quantityTotal) {
    // Adjust availability by the same delta; refuse to drop below what's already reserved.
    const delta = quantityTotal - offer.quantityTotal
    if (delta < 0) filter.quantityAvailable = { $gte: -delta }
    change.$set.quantityTotal = quantityTotal
    change.$inc = { quantityAvailable: delta }
  }

  const updated = await Offer.findOneAndUpdate(filter, change, { new: true, runValidators: true })
  if (!updated) throw ApiError.conflict('Količina ne može biti manja od već rezervisanih kesa.', 'QUANTITY_BELOW_RESERVED')
  if (input.imageUrl !== undefined && offer.imageUrl && offer.imageUrl !== updated.imageUrl) void deleteIfOwned(offer.imageUrl)
  // More bags or re-activated: let the waitlist know.
  if ((change.$inc?.quantityAvailable ?? 0) > 0 || input.status === 'active') void notifyIfAvailable(updated._id)
  return serializeOffer(updated, business)
}

export async function remove(id: string, actor: Actor) {
  const offer = await Offer.findById(id)
  if (!offer || offer.status === 'archived') throw ApiError.notFound('Ponuda nije pronađena.')
  await assertBusinessAccess(offer.business, actor)

  if (await Reservation.exists({ offer: offer._id, status: { $in: ACTIVE_RESERVATION_STATUSES } })) {
    throw ApiError.conflict('Ponuda ima aktivne rezervacije. Prvo ih otkažite ili pauzirajte ponudu.', 'HAS_ACTIVE_RESERVATIONS')
  }
  // Keep offers referenced by past reservations (history, reviews); hard-delete unused ones.
  if (await Reservation.exists({ offer: offer._id })) await Offer.updateOne({ _id: offer._id }, { status: 'archived' })
  else await offer.deleteOne()
}
