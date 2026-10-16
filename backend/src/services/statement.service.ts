/**
 * Monthly commission statement. Customers pay in the shop, so the partner
 * owes the platform its commission; discounts funded by the platform (promo
 * codes) are credited back. balance > 0 → partner pays, < 0 → platform pays.
 *
 * Commission uses the rate frozen on each reservation at pickup, so changing a
 * partner's rate never rewrites months that were already settled. Finance
 * records payments per partner and month; the statement shows what is open.
 */
import type { Types } from 'mongoose'
import { env } from '../config/env.js'
import { getMarket } from '../config/markets.js'
import { Business, PartnerPayment, Reservation, User, type IPartnerPayment } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { zonedTime } from '../utils/time.js'
import type { Actor } from './access.service.js'
import { audit } from './audit.service.js'

const market = () => getMarket(env.DEFAULT_MARKET)

export const monthOf = (date: Date) => new Intl.DateTimeFormat('en-CA', { timeZone: market().timezone, year: 'numeric', month: '2-digit' }).format(date)

function monthRange(month: string) {
  const tz = market().timezone
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

interface Agg {
  _id: { business: Types.ObjectId; month?: string }
  bags: number
  orders: number
  revenue: number
  platformDiscount: number
  /** Σ gross × frozen rate (reservations collected after rates were frozen). */
  ratedCommission: number
  /** Gross of older reservations without a frozen rate (use the location's current rate). */
  unratedGross: number
}

/** Collected reservations grouped by location (and month when `byMonth`). */
function aggregate(match: Record<string, unknown>, byMonth: boolean) {
  const gross = { $add: ['$totalMinor', { $cond: [{ $eq: ['$discountFundedBy', 'platform'] }, '$discountMinor', 0] }] }
  return Reservation.aggregate<Agg>([
    { $match: { status: 'collected', ...match } },
    {
      $group: {
        _id: { business: '$business', ...(byMonth ? { month: { $dateToString: { format: '%Y-%m', date: '$collectedAt', timezone: market().timezone } } } : {}) },
        bags: { $sum: '$quantity' },
        orders: { $sum: 1 },
        revenue: { $sum: '$totalMinor' },
        platformDiscount: { $sum: { $cond: [{ $eq: ['$discountFundedBy', 'platform'] }, '$discountMinor', 0] } },
        ratedCommission: { $sum: { $cond: [{ $eq: [{ $type: '$commissionRate' }, 'missing'] }, 0, { $multiply: [gross, '$commissionRate'] }] } },
        unratedGross: { $sum: { $cond: [{ $eq: [{ $type: '$commissionRate' }, 'missing'] }, gross, 0] } },
      },
    },
  ])
}

function toLine(b: { _id: Types.ObjectId; name: string; commissionRate?: number }, r?: Agg): Line {
  const rate = b.commissionRate ?? market().commissionRate
  const revenue = r?.revenue ?? 0
  const platformDiscount = r?.platformDiscount ?? 0
  const commission = Math.round((r?.ratedCommission ?? 0) + (r?.unratedGross ?? 0) * rate)
  return {
    businessId: b._id.toString(),
    name: b.name,
    rate,
    bags: r?.bags ?? 0,
    orders: r?.orders ?? 0,
    revenueMinor: revenue,
    platformDiscountMinor: platformDiscount,
    grossMinor: revenue + platformDiscount,
    commissionMinor: commission,
    balanceMinor: commission - platformDiscount,
  }
}

async function lines(businessFilter: Record<string, unknown>, month: string) {
  const { start, end } = monthRange(month)
  const businesses = await Business.find(businessFilter).select('name commissionRate owner deletedAt').lean()
  const rows = await aggregate({ business: { $in: businesses.map((b) => b._id) }, collectedAt: { $gte: start, $lt: end } }, false)
  const byBusiness = new Map(rows.map((r) => [r._id.business.toString(), r]))
  return businesses
    .map((b) => ({ owner: b.owner.toString(), deleted: !!b.deletedAt, line: toLine(b, byBusiness.get(b._id.toString())) }))
    .filter((x) => !x.deleted || x.line.orders > 0)
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

export type SettlementStatus = 'none' | 'unpaid' | 'partial' | 'paid' | 'overpaid'

/** What was paid against a balance and what is still open (same sign convention as balance). */
export function settlement(balanceMinor: number, payments: Pick<IPartnerPayment, 'amountMinor' | 'direction'>[]) {
  const settledMinor = payments.reduce((s, p) => s + (p.direction === 'to_platform' ? p.amountMinor : -p.amountMinor), 0)
  const remainingMinor = balanceMinor - settledMinor
  const status: SettlementStatus =
    balanceMinor === 0 && settledMinor === 0
      ? 'none'
      : remainingMinor === 0
        ? 'paid'
        : settledMinor === 0
          ? 'unpaid'
          : Math.sign(remainingMinor) === Math.sign(balanceMinor)
            ? 'partial'
            : 'overpaid'
  return { settledMinor, remainingMinor, status }
}

function serializePayment(p: IPartnerPayment & { _id: Types.ObjectId }, recordedBy?: string) {
  return {
    id: p._id.toString(),
    month: p.month,
    amountMinor: p.amountMinor,
    direction: p.direction,
    method: p.method,
    paidAt: p.paidAt.toISOString(),
    note: p.note,
    recordedBy: recordedBy ?? null,
    createdAt: p.createdAt.toISOString(),
  }
}

async function paymentsFor(filter: Record<string, unknown>) {
  const rows = await PartnerPayment.find(filter).sort({ paidAt: 1 }).lean()
  const names = new Map((await User.find({ _id: { $in: rows.map((r) => r.recordedBy) } }).select('name').lean()).map((u) => [u._id.toString(), u.name]))
  return rows.map((r) => ({ owner: r.owner.toString(), raw: r, dto: serializePayment(r, names.get(r.recordedBy.toString())) }))
}

export async function partnerStatement(actor: Actor, month: string) {
  const items = (await lines({ owner: actor.id }, month)).map((x) => x.line)
  const payments = await paymentsFor({ owner: actor.id, month })
  const t = totals(items)
  return {
    month,
    currency: market().currency,
    ...t,
    ...settlement(t.balanceMinor, payments.map((p) => p.raw)),
    payments: payments.map((p) => p.dto),
    businesses: items,
  }
}

/** Finance view: one row per partner (owner) with their locations and payments. */
export async function platformStatement(month: string) {
  const items = await lines({}, month)
  const payments = await paymentsFor({ month })
  const ownerIds = [...new Set([...items.map((i) => i.owner), ...payments.map((p) => p.owner)])]
  const users = new Map((await User.find({ _id: { $in: ownerIds } }).select('name email partnerStatus').lean()).map((u) => [u._id.toString(), u]))

  const partners = ownerIds
    .map((ownerId) => {
      const ls = items.filter((i) => i.owner === ownerId).map((i) => i.line)
      const ps = payments.filter((p) => p.owner === ownerId)
      const t = totals(ls)
      const user = users.get(ownerId)
      return {
        ownerId,
        name: user?.name ?? '—',
        email: user?.email ?? '',
        partnerStatus: user?.partnerStatus ?? 'active',
        ...t,
        ...settlement(t.balanceMinor, ps.map((p) => p.raw)),
        payments: ps.map((p) => p.dto),
        businesses: ls,
      }
    })
    .sort((a, b) => b.grossMinor - a.grossMinor)

  const all = totals(items.map((i) => i.line))
  const settledMinor = partners.reduce((s, p) => s + p.settledMinor, 0)
  // Open amounts per direction (a partner who overpaid doesn't hide another's debt).
  const owedToPlatformMinor = partners.reduce((s, p) => s + Math.max(p.remainingMinor, 0), 0)
  const owedToPartnersMinor = partners.reduce((s, p) => s + Math.max(-p.remainingMinor, 0), 0)
  return {
    month,
    currency: market().currency,
    ...all,
    settledMinor,
    owedToPlatformMinor,
    owedToPartnersMinor,
    paidPartners: partners.filter((p) => p.status === 'paid').length,
    openPartners: partners.filter((p) => p.status === 'unpaid' || p.status === 'partial' || p.status === 'overpaid').length,
    partners,
  }
}

/**
 * Everything still open, across all months: per partner the months whose
 * balance isn't fully settled. The current month is listed but flagged as in
 * progress (it isn't due yet).
 */
export async function outstanding(ownerFilter?: string) {
  const businesses = await Business.find(ownerFilter ? { owner: ownerFilter } : {}).select('name commissionRate owner').lean()
  const businessById = new Map(businesses.map((b) => [b._id.toString(), b]))
  const rows = await aggregate({ business: { $in: businesses.map((b) => b._id) } }, true)
  const payments = await PartnerPayment.find(ownerFilter ? { owner: ownerFilter } : {}).lean()

  // owner → month → balance
  const balances = new Map<string, Map<string, number>>()
  const add = (owner: string, month: string, value: number) => {
    const months = balances.get(owner) ?? new Map<string, number>()
    months.set(month, (months.get(month) ?? 0) + value)
    balances.set(owner, months)
  }
  for (const r of rows) {
    const b = businessById.get(r._id.business.toString())
    if (b && r._id.month) add(b.owner.toString(), r._id.month, toLine(b, r).balanceMinor)
  }
  for (const p of payments) add(p.owner.toString(), p.month, 0)

  const current = monthOf(new Date())
  const users = new Map((await User.find({ _id: { $in: [...balances.keys()] } }).select('name email partnerStatus').lean()).map((u) => [u._id.toString(), u]))
  const partners = [...balances.entries()]
    .map(([ownerId, months]) => {
      const open = [...months.entries()]
        .map(([month, balanceMinor]) => ({
          month,
          balanceMinor,
          inProgress: month >= current,
          ...settlement(balanceMinor, payments.filter((p) => p.owner.toString() === ownerId && p.month === month)),
        }))
        .filter((m) => m.remainingMinor !== 0)
        .sort((a, b) => b.month.localeCompare(a.month))
      const due = open.filter((m) => !m.inProgress)
      const user = users.get(ownerId)
      return {
        ownerId,
        name: user?.name ?? '—',
        email: user?.email ?? '',
        partnerStatus: user?.partnerStatus ?? 'active',
        /** Due (completed months) the partner still owes the platform; negative = platform owes. */
        dueMinor: due.reduce((s, m) => s + m.remainingMinor, 0),
        months: open,
      }
    })
    .filter((p) => p.months.length > 0)
    .sort((a, b) => b.dueMinor - a.dueMinor)

  return {
    currency: market().currency,
    currentMonth: current,
    owedToPlatformMinor: partners.reduce((s, p) => s + Math.max(p.dueMinor, 0), 0),
    owedToPartnersMinor: partners.reduce((s, p) => s + Math.max(-p.dueMinor, 0), 0),
    partners,
  }
}

export async function recordPayment(
  input: { ownerId: string; month: string; amountMinor: number; direction: 'to_platform' | 'to_partner'; method: 'bank' | 'cash' | 'other'; paidAt?: Date; note?: string },
  actor: Actor,
) {
  monthRange(input.month)
  if (input.month > monthOf(new Date())) throw ApiError.badRequest('Ne možeš evidentirati uplatu za budući mesec.', 'FUTURE_MONTH')
  const owner = await User.findById(input.ownerId).select('name email').lean()
  if (!owner || !(await Business.exists({ owner: owner._id }))) throw ApiError.notFound('Partner nije pronađen.')
  const payment = await PartnerPayment.create({
    owner: owner._id,
    month: input.month,
    amountMinor: input.amountMinor,
    direction: input.direction,
    method: input.method,
    paidAt: input.paidAt ?? new Date(),
    note: input.note,
    recordedBy: actor.id,
  })
  const amount = `${(input.amountMinor / 100).toFixed(2)} ${market().currency}`
  void audit(actor, {
    action: 'payment.record',
    targetType: 'user',
    targetId: owner._id,
    summary: `${input.direction === 'to_platform' ? 'Uplata od' : 'Isplata za'} ${owner.name} · ${input.month} · ${amount}`,
  })
  return serializePayment(payment.toObject())
}

/** Undo a wrongly recorded payment (kept in the audit log). */
export async function deletePayment(id: string, actor: Actor) {
  const payment = await PartnerPayment.findByIdAndDelete(id)
  if (!payment) throw ApiError.notFound('Uplata nije pronađena.')
  void audit(actor, {
    action: 'payment.delete',
    targetType: 'user',
    targetId: payment.owner,
    summary: `Poništena uplata · ${payment.month} · ${(payment.amountMinor / 100).toFixed(2)} ${market().currency}`,
  })
}

export async function setCommission(businessId: string, rate: number | null) {
  const business = await Business.findByIdAndUpdate(businessId, rate == null ? { $unset: { commissionRate: 1 } } : { $set: { commissionRate: rate } }, { new: true })
  if (!business) throw ApiError.notFound('Lokal nije pronađen.')
  return { businessId: business.id as string, commissionRate: business.commissionRate ?? null }
}
