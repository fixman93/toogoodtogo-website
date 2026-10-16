/**
 * Partner staff: the owner of a location adds employees by e-mail. Staff can
 * only scan pickups and see orders for the locations they're assigned to.
 */
import { Business, User } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { assertBusinessAccess, type Actor } from './access.service.js'
import { notify } from './notification.service.js'

export async function list(businessId: string, actor: Actor) {
  const business = await assertBusinessAccess(businessId, actor)
  const staff = await User.find({ staffOf: business._id, deletedAt: null }).select('name email isBlocked').sort({ name: 1 }).lean()
  return staff.map((u) => ({ id: u._id.toString(), name: u.name, email: u.email }))
}

export async function add(businessId: string, email: string, actor: Actor) {
  const business = await assertBusinessAccess(businessId, actor)
  const user = await User.findOne({ email: email.toLowerCase(), deletedAt: null })
  if (!user) throw ApiError.notFound('Ne postoji nalog sa tom e-poštom. Zaposleni prvo treba da se registruje.', 'USER_NOT_FOUND')
  if (user.id === actor.id) throw ApiError.conflict('Ti već imaš pristup ovoj lokaciji.', 'ALREADY_OWNER')
  if (user.role !== 'customer' && user.role !== 'staff') {
    throw ApiError.conflict('Ovaj nalog je partner ili član tima i ne može biti zaposleni.', 'ROLE_CONFLICT')
  }
  await User.updateOne({ _id: user._id }, { $set: { role: 'staff' }, $addToSet: { staffOf: business._id } })
  void notify([user._id], {
    type: 'staff_added',
    title: `Dodat si kao zaposleni: ${business.name}`,
    body: 'Možeš da skeniraš kodove i vidiš narudžbine ove lokacije.',
    link: '/business/scan',
  })
  return { id: user.id as string, name: user.name, email: user.email }
}

export async function remove(businessId: string, userId: string, actor: Actor) {
  const business = await assertBusinessAccess(businessId, actor)
  const user = await User.findOneAndUpdate({ _id: userId, staffOf: business._id }, { $pull: { staffOf: business._id } }, { new: true })
  if (!user) throw ApiError.notFound('Zaposleni nije pronađen.')
  // No locations left → back to a regular customer account.
  if (user.role === 'staff' && user.staffOf.length === 0) await User.updateOne({ _id: user._id }, { $set: { role: 'customer' } })
}

/** Names of the locations a staff member works at (for their portal). */
export async function myWorkplaces(actor: Actor) {
  const businesses = await Business.find({ _id: { $in: actor.staffOf ?? [] }, deletedAt: null }).select('name address').lean()
  return businesses.map((b) => ({ id: b._id.toString(), name: b.name, address: b.address }))
}
