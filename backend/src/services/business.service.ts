import { randomBytes } from 'node:crypto'
import { env } from '../config/env.js'
import { MARKETS, getMarket } from '../config/markets.js'
import { Business, Offer } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { serializeBusiness } from '../utils/serializers.js'
import { escapeRegex, slugify } from '../utils/text.js'
import type { CreateBusinessInput, UpdateBusinessInput } from '../validators/business.validators.js'
import { assertBusinessAccess, isAdmin, type Actor } from './access.service.js'

const toPoint = ({ lat, lng }: { lat: number; lng: number }) => ({ type: 'Point' as const, coordinates: [lng, lat] as [number, number] })

export async function list(query: { owner?: 'me'; city?: string; category?: string; page: number; limit: number }, actor?: Actor) {
  const filter: Record<string, unknown> = {}
  if (query.owner === 'me') {
    if (!actor) throw ApiError.unauthorized()
    filter.owner = actor.id
  } else {
    filter.isActive = true
  }
  if (query.city) filter['address.city'] = new RegExp(`^${escapeRegex(query.city)}$`, 'i')
  if (query.category) filter.category = query.category

  const [items, total] = await Promise.all([
    Business.find(filter).sort({ name: 1 }).skip((query.page - 1) * query.limit).limit(query.limit),
    Business.countDocuments(filter),
  ])
  return { items: items.map(serializeBusiness), meta: { page: query.page, limit: query.limit, total } }
}

export async function get(id: string, actor?: Actor) {
  const business = await Business.findById(id)
  const canSeeInactive = actor && (isAdmin(actor) || business?.owner.toString() === actor.id)
  if (!business || (!business.isActive && !canSeeInactive)) throw ApiError.notFound('Lokal nije pronađen.')
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
  const business = await assertBusinessAccess(id, actor)
  const { location, address, ...rest } = input
  business.set(rest)
  if (address) business.set('address', address)
  if (location) business.location = toPoint(location)
  await business.save()

  // Keep denormalized offer fields in sync; deactivating a business pauses its offers.
  await Offer.updateMany(
    { business: business._id },
    { $set: { businessName: business.name, city: business.address.city, location: business.location, timezone: business.timezone } },
  )
  if (input.isActive === false) await Offer.updateMany({ business: business._id, status: 'active' }, { $set: { status: 'paused' } })

  return serializeBusiness(business)
}
