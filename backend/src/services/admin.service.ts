/**
 * Platform administration (role "admin"): overview numbers, user roles and
 * moderation of every location. Routes are admin-only; the guards below also
 * stop an admin from locking the platform out of administration.
 */
import { env } from '../config/env.js'
import { getMarket } from '../config/markets.js'
import { Business, Offer, PLATFORM_ROLES, Reservation, Review, User, type Role } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { serializeBusiness, serializeUser } from '../utils/serializers.js'
import { escapeRegex } from '../utils/text.js'
import { zonedTime } from '../utils/time.js'
import type { AdminBusinessesQuery, AdminUsersQuery } from '../validators/admin.validators.js'
import type { Actor } from './access.service.js'
import { audit } from './audit.service.js'
import * as moderation from './partner-moderation.service.js'
import { toDto } from './reservation.service.js'

export async function stats() {
  const tz = getMarket(env.DEFAULT_MARKET).timezone
  const now = new Date()
  const todayStart = zonedTime(0, '00:00', tz, now)
  const tomorrowStart = zonedTime(1, '00:00', tz, now)

  const [usersByRole, businesses, activeBusinesses, liveOffers, reservationsByStatus, reservationsToday] = await Promise.all([
    User.aggregate<{ _id: Role; count: number }>([{ $group: { _id: '$role', count: { $sum: 1 } } }]),
    Business.countDocuments({ deletedAt: null }),
    Business.countDocuments({ deletedAt: null, isActive: true }),
    Offer.countDocuments({ status: 'active', pickupEnd: { $gt: now } }),
    Reservation.aggregate<{ _id: string; count: number }>([{ $group: { _id: '$status', count: { $sum: 1 } } }]),
    Reservation.countDocuments({ pickupStart: { $gte: todayStart, $lt: tomorrowStart } }),
  ])

  const role = (r: Role) => usersByRole.find((x) => x._id === r)?.count ?? 0
  const status = (s: string) => reservationsByStatus.find((x) => x._id === s)?.count ?? 0
  return {
    users: { total: role('customer') + role('business') + role('admin'), customers: role('customer'), partners: role('business'), admins: role('admin') },
    businesses: { total: businesses, active: activeBusinesses },
    offers: { live: liveOffers },
    reservations: {
      total: reservationsByStatus.reduce((sum, x) => sum + x.count, 0),
      today: reservationsToday,
      upcoming: status('confirmed') + status('pending_payment'),
      collected: status('collected'),
    },
  }
}

export async function listUsers(query: AdminUsersQuery) {
  const filter: Record<string, unknown> = { deletedAt: null }
  if (query.role) filter.role = query.role
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), 'i')
    // "064 123…" finds +38164123…: match on the digits after the leading 0.
    const digits = query.q.replace(/\D/g, '').replace(/^0+/, '')
    filter.$or = [{ name: rx }, { email: rx }, ...(digits.length >= 4 ? [{ phone: new RegExp(escapeRegex(digits)) }] : [])]
  }
  const [users, total] = await Promise.all([
    User.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
    User.countDocuments(filter),
  ])
  const counts = await Business.aggregate<{ _id: unknown; count: number }>([
    { $match: { owner: { $in: users.map((u) => u._id) }, deletedAt: null } },
    { $group: { _id: '$owner', count: { $sum: 1 } } },
  ])
  const byOwner = new Map(counts.map((c) => [String(c._id), c.count]))
  return {
    items: users.map((u) => ({ ...serializeUser(u), isBlocked: u.isBlocked, partnerStatus: u.partnerStatus ?? 'active', businessCount: byOwner.get(u.id) ?? 0 })),
    meta: { page: query.page, limit: query.limit, total },
  }
}

export async function setRole(userId: string, role: Role, actor: Actor) {
  if (userId === actor.id) throw ApiError.conflict('Ne možeš menjati sopstvenu ulogu.', 'CANNOT_CHANGE_OWN_ROLE')
  const user = await User.findById(userId)
  if (!user) throw ApiError.notFound('Korisnik nije pronađen.')
  if (user.role === 'admin' && role !== 'admin' && (await User.countDocuments({ role: 'admin' })) <= 1) {
    throw ApiError.conflict('Aplikacija mora imati bar jednog admina.', 'LAST_ADMIN')
  }
  const previous = user.role
  user.role = role
  // Staff assignments only make sense for the staff role.
  if (role !== 'staff') user.staffOf = []
  await user.save()
  void audit(actor, { action: 'user.role', targetType: 'user', targetId: user._id, summary: `${user.email}: ${previous} → ${role}` })
  const businessCount = await Business.countDocuments({ owner: user._id })
  return { ...serializeUser(user), businessCount }
}

export async function listBusinesses(query: AdminBusinessesQuery) {
  const filter: Record<string, unknown> = { deletedAt: null }
  if (query.status) filter.isActive = query.status === 'active'
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), 'i')
    filter.$or = [{ name: rx }, { 'address.city': rx }, { 'address.street': rx }]
  }
  const [businesses, total] = await Promise.all([
    Business.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit),
    Business.countDocuments(filter),
  ])
  const [owners, offerCounts] = await Promise.all([
    User.find({ _id: { $in: businesses.map((b) => b.owner) } }).select('name email').lean(),
    Offer.aggregate<{ _id: unknown; count: number }>([
      { $match: { business: { $in: businesses.map((b) => b._id) }, status: 'active', pickupEnd: { $gt: new Date() } } },
      { $group: { _id: '$business', count: { $sum: 1 } } },
    ]),
  ])
  const ownerById = new Map(owners.map((o) => [o._id.toString(), o]))
  const liveById = new Map(offerCounts.map((c) => [String(c._id), c.count]))
  return {
    items: businesses.map((b) => {
      const owner = ownerById.get(b.owner.toString())
      return {
        ...serializeBusiness(b),
        owner: owner ? { id: owner._id.toString(), name: owner.name, email: owner.email } : null,
        liveOfferCount: liveById.get(b.id) ?? 0,
      }
    }),
    meta: { page: query.page, limit: query.limit, total },
  }
}

export async function setBlocked(userId: string, blocked: boolean, actor: Actor) {
  if (userId === actor.id) throw ApiError.conflict('Ne možeš blokirati sopstveni nalog.', 'CANNOT_BLOCK_SELF')
  const user = await User.findById(userId)
  if (!user || user.deletedAt) throw ApiError.notFound('Korisnik nije pronađen.')
  if (blocked && PLATFORM_ROLES.includes(user.role)) throw ApiError.conflict('Nalog tima se ne može blokirati. Prvo mu promeni ulogu.', 'CANNOT_BLOCK_ADMIN')
  // Partners: blocking also hides their locations and offers (see partner-moderation).
  const partnerSuspended = (user.partnerStatus ?? 'active') !== 'active'
  if ((blocked || partnerSuspended) && (await Business.exists({ owner: user._id, deletedAt: null }))) {
    await moderation.setStatus(userId, blocked ? 'blocked' : 'active', blocked ? 'Nalog je blokirao tim Foodnesi.' : undefined, actor)
    const fresh = await User.findById(userId)
    return { ...serializeUser(fresh!), isBlocked: fresh!.isBlocked, partnerStatus: fresh!.partnerStatus ?? 'active', businessCount: await Business.countDocuments({ owner: user._id, deletedAt: null }) }
  }
  user.isBlocked = blocked
  await user.save()
  void audit(actor, { action: blocked ? 'user.block' : 'user.unblock', targetType: 'user', targetId: user._id, summary: `${blocked ? 'Blokiran' : 'Odblokiran'}: ${user.email}` })
  const businessCount = await Business.countDocuments({ owner: user._id, deletedAt: null })
  return { ...serializeUser(user), isBlocked: user.isBlocked, businessCount }
}

/** All reservations on the platform (newest first), searchable by pickup code. */
export async function listReservations(query: { status?: string; q?: string; page: number; limit: number }, actor: Actor) {
  const filter: Record<string, unknown> = {}
  if (query.status) filter.status = query.status
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), 'i')
    filter.$or = [{ code: rx }, { offerTitle: rx }]
  }
  const [rows, total] = await Promise.all([
    Reservation.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
    Reservation.countDocuments(filter),
  ])
  return { items: await toDto(rows, actor), meta: { page: query.page, limit: query.limit, total } }
}

export async function listReviews(query: { hidden?: boolean; page: number; limit: number }) {
  const filter = query.hidden == null ? {} : query.hidden ? { isHidden: true } : { isHidden: { $ne: true } }
  const [rows, total] = await Promise.all([
    Review.find(filter).sort({ createdAt: -1 }).skip((query.page - 1) * query.limit).limit(query.limit).lean(),
    Review.countDocuments(filter),
  ])
  const [users, businesses] = await Promise.all([
    User.find({ _id: { $in: rows.map((r) => r.user) } }).select('name email').lean(),
    Business.find({ _id: { $in: rows.map((r) => r.business) } }).select('name').lean(),
  ])
  const userById = new Map(users.map((u) => [u._id.toString(), u]))
  const businessById = new Map(businesses.map((b) => [b._id.toString(), b]))
  return {
    items: rows.map((r) => ({
      id: r._id.toString(),
      rating: r.rating,
      comment: r.comment,
      isHidden: !!r.isHidden,
      createdAt: r.createdAt.toISOString(),
      user: userById.get(r.user.toString()) ? { name: userById.get(r.user.toString())!.name, email: userById.get(r.user.toString())!.email } : null,
      business: businessById.get(r.business.toString()) ? { id: r.business.toString(), name: businessById.get(r.business.toString())!.name } : null,
    })),
    meta: { page: query.page, limit: query.limit, total },
  }
}

/** Hide/unhide a review and keep the business average consistent (atomic update). */
export async function setReviewHidden(id: string, hidden: boolean, actor: Actor) {
  const review = await Review.findOneAndUpdate({ _id: id, isHidden: hidden ? { $ne: true } : true }, { $set: { isHidden: hidden } }, { new: true })
  if (!review) throw ApiError.conflict('Ocena je već u tom stanju ili ne postoji.', 'NO_CHANGE')
  const sign = hidden ? -1 : 1
  const newCount = { $add: ['$rating.count', sign] }
  await Business.updateOne({ _id: review.business }, [
    {
      $set: {
        'rating.average': {
          $cond: [
            { $lte: [newCount, 0] },
            0,
            { $divide: [{ $add: [{ $multiply: ['$rating.average', '$rating.count'] }, sign * review.rating] }, newCount] },
          ],
        },
        'rating.count': { $max: [newCount, 0] },
      },
    },
  ])
  void audit(actor, { action: hidden ? 'review.hide' : 'review.show', targetType: 'review', targetId: review._id, summary: `${hidden ? 'Sakrivena' : 'Vraćena'} ocena ${review.rating}★` })
  return { id: review.id as string, isHidden: review.isHidden }
}
