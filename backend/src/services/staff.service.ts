/**
 * Partner staff: the owner of a location adds employees by e-mail. Staff can
 * only scan pickups and see orders for the locations they're assigned to.
 */
import { Business, User } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { assertBusinessAccess, type Actor } from './access.service.js'
import { audit } from './audit.service.js'
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
  await assertSameOwner(user, business.owner.toString())
  await User.updateOne({ _id: user._id }, { $set: { role: 'staff' }, $addToSet: { staffOf: business._id } })
  void notify([user._id], {
    type: 'staff_added',
    title: `Dodat si kao zaposleni: ${business.name}`,
    body: 'Možeš da skeniraš kodove i vidiš narudžbine ove lokacije.',
    link: '/business/scan',
  }, { email: 'fallback' })
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

// ---------------------------------------------------------------------------
// Access per location. A staff member works for ONE partner and sees only the
// locations assigned to them (scanner + orders of those locations).

type UserDoc = InstanceType<typeof User>

/** Only regular accounts (customer/staff) can become staff; partners and the platform team can't. */
function assertCanBeStaff(user: UserDoc) {
  if (user.role !== 'customer' && user.role !== 'staff') {
    throw ApiError.conflict('Ovaj nalog je partner ili član tima i ne može biti zaposleni.', 'ROLE_CONFLICT')
  }
}

/** Validates the locations (existing, one owner) and returns them. */
async function locationsOfOneOwner(businessIds: string[]) {
  const businesses = await Business.find({ _id: { $in: businessIds }, deletedAt: null }).select('name owner').lean()
  if (businesses.length !== new Set(businessIds).size) throw ApiError.badRequest('Neka od izabranih lokacija ne postoji.', 'LOCATION_NOT_FOUND')
  const owners = new Set(businesses.map((b) => b.owner.toString()))
  if (owners.size > 1) throw ApiError.badRequest('Zaposleni može raditi samo za jednog partnera – izaberi lokacije istog partnera.', 'MULTIPLE_PARTNERS')
  return businesses
}

/** A staff member already working for another partner can't be added. */
async function assertSameOwner(user: UserDoc, ownerId: string) {
  if (!user.staffOf?.length) return
  const other = await Business.findOne({ _id: { $in: user.staffOf }, owner: { $ne: ownerId } }).select('name').lean()
  if (other) throw ApiError.conflict(`Ovaj nalog već radi za drugog partnera (${other.name}).`, 'OTHER_PARTNER')
}

/** Replace the user's locations; none left → back to a customer account. */
async function applyAccess(user: UserDoc, businesses: { _id: unknown; name: string }[]) {
  const before = new Set((user.staffOf ?? []).map(String))
  user.staffOf = businesses.map((b) => b._id) as UserDoc['staffOf']
  user.role = businesses.length ? 'staff' : 'customer'
  await user.save()
  const added = businesses.filter((b) => !before.has(String(b._id)))
  if (added.length) {
    void notify([user._id], {
      type: 'staff_added',
      title: `Dodat si kao zaposleni: ${added.map((b) => b.name).join(', ')}`,
      body: 'Možeš da skeniraš kodove i vidiš narudžbine ovih lokacija.',
      link: '/business/scan',
    }, { email: 'fallback' })
  }
}

const teamMember = (u: { _id: unknown; name: string; email: string; staffOf?: unknown[] }, ownIds: Set<string>) => ({
  id: String(u._id),
  name: u.name,
  email: u.email,
  businessIds: (u.staffOf ?? []).map(String).filter((id) => ownIds.has(id)),
})

/** Owner: all staff across their locations, with which locations each one sees. */
export async function team(actor: Actor) {
  const locations = await Business.find({ owner: actor.id, deletedAt: null }).select('name address').sort({ name: 1 }).lean()
  const ownIds = new Set(locations.map((b) => b._id.toString()))
  const staff = await User.find({ staffOf: { $in: [...ownIds] }, deletedAt: null }).select('name email staffOf').sort({ name: 1 }).lean()
  return {
    locations: locations.map((b) => ({ id: b._id.toString(), name: b.name, address: b.address })),
    members: staff.map((u) => teamMember(u, ownIds)),
  }
}

/** Owner: add a staff member (by e-mail) or change which of the owner's locations they see. */
export async function setTeamMember(input: { email?: string; userId?: string; businessIds: string[] }, actor: Actor) {
  const own = await Business.find({ owner: actor.id, deletedAt: null }).select('name').lean()
  const ownIds = new Set(own.map((b) => b._id.toString()))
  if (input.businessIds.some((id) => !ownIds.has(id))) throw ApiError.forbidden('Možeš dodeliti samo svoje lokacije.')
  const user = input.userId
    ? await User.findOne({ _id: input.userId, deletedAt: null })
    : await User.findOne({ email: input.email?.toLowerCase(), deletedAt: null })
  if (!user) throw ApiError.notFound('Ne postoji nalog sa tom e-poštom. Zaposleni prvo treba da se registruje.', 'USER_NOT_FOUND')
  if (user.id === actor.id) throw ApiError.conflict('Ti već imaš pristup svojim lokacijama.', 'ALREADY_OWNER')
  assertCanBeStaff(user)
  await assertSameOwner(user, actor.id)
  if (input.userId && !(user.staffOf ?? []).some((id) => ownIds.has(String(id)))) throw ApiError.notFound('Zaposleni nije pronađen.')
  await applyAccess(user, own.filter((b) => input.businessIds.includes(b._id.toString())))
  return teamMember(user.toObject(), ownIds)
}

/** Platform: which partner and locations a user works at. */
export async function staffAccess(userId: string) {
  const user = await User.findById(userId).select('staffOf').lean()
  if (!user) throw ApiError.notFound('Korisnik nije pronađen.')
  const businesses = await Business.find({ _id: { $in: user.staffOf ?? [] }, deletedAt: null }).select('owner').lean()
  return { ownerId: businesses[0]?.owner.toString() ?? null, businessIds: businesses.map((b) => b._id.toString()) }
}

/** Platform (admin): make someone staff of chosen locations of ONE partner (empty → regular customer). */
export async function setStaffAccess(userId: string, businessIds: string[], actor: Actor) {
  const user = await User.findOne({ _id: userId, deletedAt: null })
  if (!user) throw ApiError.notFound('Korisnik nije pronađen.')
  if (user.id === actor.id) throw ApiError.conflict('Ne možeš menjati sopstvenu ulogu.', 'CANNOT_CHANGE_OWN_ROLE')
  assertCanBeStaff(user)
  const businesses = await locationsOfOneOwner(businessIds)
  await applyAccess(user, businesses)
  void audit(actor, {
    action: 'user.staff_access',
    targetType: 'user',
    targetId: user._id,
    summary: businesses.length ? `${user.email}: zaposleni u ${businesses.map((b) => b.name).join(', ')}` : `${user.email}: uklonjen pristup lokacijama`,
  })
  return staffAccess(user.id)
}
