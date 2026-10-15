/**
 * Platform administration (role "admin"): overview numbers, user roles and
 * moderation of every location. Routes are admin-only; the guards below also
 * stop an admin from locking the platform out of administration.
 */
import { env } from '../config/env.js'
import { getMarket } from '../config/markets.js'
import { Business, Offer, Reservation, User, type Role } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { serializeBusiness, serializeUser } from '../utils/serializers.js'
import { escapeRegex } from '../utils/text.js'
import { zonedTime } from '../utils/time.js'
import type { AdminBusinessesQuery, AdminUsersQuery } from '../validators/admin.validators.js'
import type { Actor } from './access.service.js'

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
  const filter: Record<string, unknown> = {}
  if (query.role) filter.role = query.role
  if (query.q) {
    const rx = new RegExp(escapeRegex(query.q), 'i')
    filter.$or = [{ name: rx }, { email: rx }]
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
    items: users.map((u) => ({ ...serializeUser(u), businessCount: byOwner.get(u.id) ?? 0 })),
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
  user.role = role
  await user.save()
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
