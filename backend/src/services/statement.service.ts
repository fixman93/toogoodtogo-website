/**
 * Monthly commission statement. Customers pay in the shop, so the partner
 * owes the platform its commission; discounts funded by the platform (promo
 * codes) are credited back. balance > 0 → partner pays, < 0 → platform pays.
 */
import type { Types } from 'mongoose'
import { env } from '../config/env.js'
import { getMarket } from '../config/markets.js'
import { Business, Reservation, User } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { zonedTime } from '../utils/time.js'
import type { Actor } from './access.service.js'

function monthRange(month: string) {
  const tz = getMarket(env.DEFAULT_MARKET).timezone
  const [y, m] = month.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) throw ApiError.badRequest('Mesec mora biti u formatu YYYY-MM.')
  const anchor = (yy: number, mm: number) => new Date(Date.UTC(yy, mm - 1, 1, 12))
  return { start: zonedTime(0, '00:00', tz, anchor(y, m)), end: zonedTime(0, '00:00', tz, anchor(m === 12 ? y + 1 : y, m === 12 ? 1 : m + 1)) }
}

interface Line {
  businessId: string
  name: string
  rate: number
  bags: number
  orders: number
  revenueMinor: number
  platformDiscountMinor: number
  grossMinor: number
  commissionMinor: number
  balanceMinor: number
}

async function lines(businessFilter: Record<string, unknown>, month: string): Promise<Line[]> {
  const { start, end } = monthRange(month)
  const market = getMarket(env.DEFAULT_MARKET)
  const businesses = await Business.find(businessFilter).select('name commissionRate owner').lean()
  const rows = await Reservation.aggregate<{ _id: Types.ObjectId; bags: number; orders: number; revenue: number; platformDiscount: number }>([
    { $match: { business: { $in: businesses.map((b) => b._id) }, status: 'collected', collectedAt: { $gte: start, $lt: end } } },
    {
      $group: {
        _id: '$business',
        bags: { $sum: '$quantity' },
        orders: { $sum: 1 },
        revenue: { $sum: '$totalMinor' },
        platformDiscount: { $sum: { $cond: [{ $eq: ['$discountFundedBy', 'platform'] }, '$discountMinor', 0] } },
      },
    },
  ])
  const byBusiness = new Map(rows.map((r) => [r._id.toString(), r]))
  return businesses.map((b) => {
    const r = byBusiness.get(b._id.toString())
    const rate = b.commissionRate ?? market.commissionRate
    const revenue = r?.revenue ?? 0
    const platformDiscount = r?.platformDiscount ?? 0
    const gross = revenue + platformDiscount
    const commission = Math.round(gross * rate)
    return {
      businessId: b._id.toString(),
      name: b.name,
      rate,
      bags: r?.bags ?? 0,
      orders: r?.orders ?? 0,
      revenueMinor: revenue,
      platformDiscountMinor: platformDiscount,
      grossMinor: gross,
      commissionMinor: commission,
      balanceMinor: commission - platformDiscount,
    }
  })
}

const sum = (items: Line[], key: keyof Line) => items.reduce((s, l) => s + (l[key] as number), 0)
const totals = (items: Line[]) => ({
  bags: sum(items, 'bags'),
  orders: sum(items, 'orders'),
  revenueMinor: sum(items, 'revenueMinor'),
  platformDiscountMinor: sum(items, 'platformDiscountMinor'),
  grossMinor: sum(items, 'grossMinor'),
  commissionMinor: sum(items, 'commissionMinor'),
  balanceMinor: sum(items, 'balanceMinor'),
})

export async function partnerStatement(actor: Actor, month: string) {
  const items = await lines({ owner: actor.id }, month)
  return { month, currency: getMarket(env.DEFAULT_MARKET).currency, ...totals(items), businesses: items }
}

/** Finance view: one row per partner (owner) with their locations. */
export async function platformStatement(month: string) {
  const items = await lines({}, month)
  const owners = await Business.find({ _id: { $in: items.map((i) => i.businessId) } }).select('owner').lean()
  const ownerOf = new Map(owners.map((b) => [b._id.toString(), b.owner.toString()]))
  const users = new Map((await User.find({ _id: { $in: [...new Set(ownerOf.values())] } }).select('name email').lean()).map((u) => [u._id.toString(), u]))
  const groups = new Map<string, Line[]>()
  for (const line of items) {
    const owner = ownerOf.get(line.businessId)!
    groups.set(owner, [...(groups.get(owner) ?? []), line])
  }
  const partners = [...groups.entries()]
    .map(([ownerId, ls]) => ({ ownerId, name: users.get(ownerId)?.name ?? '—', email: users.get(ownerId)?.email ?? '', ...totals(ls), businesses: ls }))
    .filter((p) => p.orders > 0 || p.businesses.length > 0)
    .sort((a, b) => b.grossMinor - a.grossMinor)
  return { month, currency: getMarket(env.DEFAULT_MARKET).currency, ...totals(items), partners }
}

export async function setCommission(businessId: string, rate: number | null) {
  const business = await Business.findByIdAndUpdate(businessId, rate == null ? { $unset: { commissionRate: 1 } } : { $set: { commissionRate: rate } }, { new: true })
  if (!business) throw ApiError.notFound('Lokal nije pronađen.')
  return { businessId: business.id as string, commissionRate: business.commissionRate ?? null }
}
