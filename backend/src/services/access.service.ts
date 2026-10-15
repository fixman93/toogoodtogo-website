import type { Types } from 'mongoose'
import { Business } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'

export type Actor = { id: string; role: string }

export const isAdmin = (actor?: Actor) => actor?.role === 'admin'

/** Loads a business and asserts the actor owns it (or is an admin). */
export async function assertBusinessAccess(businessId: string | Types.ObjectId, actor: Actor) {
  const business = await Business.findById(businessId)
  if (!business || business.deletedAt) throw ApiError.notFound('Lokal nije pronađen.')
  if (!isAdmin(actor) && business.owner.toString() !== actor.id) throw ApiError.forbidden('Ovaj lokal ne pripada vašem nalogu.')
  return business
}
