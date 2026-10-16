import type { Types } from 'mongoose'
import { marketFor } from '../config/markets.js'
import { can, type Permission } from '../config/permissions.js'
import { Business, type IBusiness } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'

export type Actor = { id: string; role: string; staffOf?: string[] }

/** Super admin. */
export const isAdmin = (actor?: Actor) => actor?.role === 'admin'

export const hasPermission = (actor: Actor | undefined, permission: Permission) => can(actor?.role as never, permission)

/** Owner, a staff member assigned to this location, or super admin. */
export function worksAt(business: Pick<IBusiness, 'owner'> & { _id: Types.ObjectId }, actor: Actor) {
  return isAdmin(actor) || business.owner.toString() === actor.id || (actor.staffOf ?? []).includes(business._id.toString())
}

/** Loads a business and asserts the actor owns it (or is an admin). */
export async function assertBusinessAccess(businessId: string | Types.ObjectId, actor: Actor) {
  const business = await Business.findById(businessId)
  if (!business || business.deletedAt) throw ApiError.notFound('Lokal nije pronađen.')
  if (!isAdmin(actor) && business.owner.toString() !== actor.id) throw ApiError.forbidden('Ovaj lokal ne pripada vašem nalogu.')
  return business
}

/** Like assertBusinessAccess, but staff assigned to the location are allowed too. */
export async function assertWorksAt(businessId: string | Types.ObjectId, actor: Actor) {
  const business = await Business.findById(businessId)
  if (!business || business.deletedAt) throw ApiError.notFound('Lokal nije pronađen.')
  if (!worksAt(business, actor)) throw ApiError.forbidden('Nemaš pristup ovoj lokaciji.')
  return business
}

/** Ids of every location the actor owns or works at. */
export async function workplaceIds(actor: Actor) {
  const owned = await Business.find({ owner: actor.id, deletedAt: null }).select('_id').lean()
  const ids = new Set([...owned.map((b) => b._id.toString()), ...(actor.staffOf ?? [])])
  return [...ids]
}

/**
 * Currency and timezone of a partner (all their locations share one currency,
 * see business.service). Falls back to the default market for a new partner.
 */
export async function partnerLocale(ownerId: string | Types.ObjectId) {
  const b = await Business.findOne({ owner: ownerId }).sort({ deletedAt: 1, createdAt: 1 }).select('currency timezone address.countryCode').lean()
  const market = marketFor(b?.address.countryCode)
  return { currency: b?.currency ?? market.currency, timezone: b?.timezone ?? market.timezone, countryCode: market.code }
}
