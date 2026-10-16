/**
 * Monthly commission statement. Customers pay in the shop, so the partner
 * owes the platform its commission; discounts funded by the platform (promo
 * codes) are credited back. balance > 0 → partner pays, < 0 → platform pays.
 *
 * Commission uses the rate frozen on each reservation at pickup, so changing a
 * partner's rate never rewrites months that were already settled. Finance
 * records payments per partner and month; the statement shows what is open.
 *
 * Money is always in the partner's own currency (one currency per partner,
 * see business.service) and months follow each location's timezone. Platform
 * totals are reported per currency — RSD and EUR are never added together.
 */
import type { Types } from 'mongoose'
import { env } from '../config/env.js'
import { marketFor } from '../config/markets.js'
import { Business, PartnerPayment, Reservation, User, type IPartnerPayment } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { partnerLocale, type Actor } from './access.service.js'
import { audit } from './audit.service.js'

const defaultMarket = () => marketFor(env.DEFAULT_MARKET)

export const monthOf = (date: Date, timeZone = defaultMarket().timezone) =>
  new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).format(date)

/** UTC window that contains the month in every supported timezone (exact month is matched per reservation). */
function monthWindow(month: string) {
  const [y, m] = month.split('-').map(Number)
  if (!y || !m || m < 1 || m > 12) throw ApiError.badRequest('Mesec mora biti u formatu YYYY-MM.')
  return { start: new Date(Date.UTC(y, m - 1, 1) - 86_400_000), end: new Date(Date.UTC(m === 12 ? y + 1 : y, m === 12 ? 0 : m, 1) + 86_400_000) }
}

const formatAmount = (minor: number, currency: string) => `${(minor / 100).toFixed(2)} ${currency}`

interface Line {
  businessId: string
  name: string
  currency: string
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

/**
 * Collected reservations grouped by location (and month when `byMonth`). The
 * month is the local month of pickup in the reservation's own timezone;
 * `month` restricts the result to one month.
 */
function aggregate(match: Record<string, unknown>, options: { byMonth?: boolean; month?: string }) {
  const gross = { $add: ['$totalMinor', { $cond: [{ $eq: ['$discountFundedBy', 'platform'] }, '$discountMinor', 0] }] }
  const localMonth = { $dateToString: { format: '%Y-%m', date: '$collectedAt', timezone: { $ifNull: ['$timezone', defaultMarket().timezone] } } }
  return Reservation.aggregate<Agg>([
    { $match: { status: 'collected', ...match } },
    { $addFields: { localMonth } },
    ...(options.month ? [{ $match: { localMonth: options.month } }] : []),
    {
      $group: {
        _id: { business: '$business', ...(options.byMonth ? { month: '$localMonth' } : {}) },
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

type BusinessRow = { _id: Types.ObjectId; name: string; currency: string; commissionRate?: number; address: { countryCode: string } }

function toLine(b: BusinessRow, r?: Agg): Line {
  const rate = b.commissionRate ?? marketFor(b.address.countryCode).commissionRate
  const revenue = r?.revenue ?? 0
  const platformDiscount = r?.platformDiscount ?? 0
  const commission = Math.round((r?.ratedCommission ?? 0) + (r?.unratedGross ?? 0) * rate)
  return {
    businessId: b._id.toString(),
    name: b.name,
    currency: b.currency,
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

const BUSINESS_FIELDS = 'name currency commissionRate owner deletedAt address.countryCode'

async function lines(businessFilter: Record<string, unknown>, month: string) {
  const { start, end } = monthWindow(month)
  const businesses = await Business.find(businessFilter).select(BUSINESS_FIELDS).lean()
  const rows = await aggregate({ business: { $in: businesses.map((b) => b._id) }, collectedAt: { $gte: start, $lt: end } }, { month })
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
    currency: p.currency ?? defaultMarket().currency,
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
    currency: items[0]?.currency ?? (await partnerLocale(actor.id)).currency,
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
  const currencyOf = new Map<string, string>()
  for (const i of items) currencyOf.set(i.owner, i.line.currency)
  for (const p of payments) if (!currencyOf.has(p.owner)) currencyOf.set(p.owner, p.dto.currency)

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
        currency: currencyOf.get(ownerId) ?? defaultMarket().currency,
        ...t,
        ...settlement(t.balanceMinor, ps.map((p) => p.raw)),
        payments: ps.map((p) => p.dto),
        businesses: ls,
      }
    })
    .sort((a, b) => b.grossMinor - a.grossMinor)

  // Totals per currency. Open amounts per direction (one partner's overpayment doesn't hide another's debt).
  const currencies = [...new Set(partners.map((p) => p.currency))].sort().map((currency) => {
    const group = partners.filter((p) => p.currency === currency)
    return {
      currency,
      ...totals(items.filter((i) => i.line.currency === currency).map((i) => i.line)),
      settledMinor: group.reduce((s, p) => s + p.settledMinor, 0),
      owedToPlatformMinor: group.reduce((s, p) => s + Math.max(p.remainingMinor, 0), 0),
      owedToPartnersMinor: group.reduce((s, p) => s + Math.max(-p.remainingMinor, 0), 0),
    }
  })
  return {
    month,
    currencies,
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
  const businesses = await Business.find(ownerFilter ? { owner: ownerFilter } : {}).select(`${BUSINESS_FIELDS} timezone`).lean()
  const businessById = new Map(businesses.map((b) => [b._id.toString(), b]))
  const ownerLocale = new Map(businesses.map((b) => [b.owner.toString(), { currency: b.currency, timezone: b.timezone }]))
  const rows = await aggregate({ business: { $in: businesses.map((b) => b._id) } }, { byMonth: true })
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

  const users = new Map((await User.find({ _id: { $in: [...balances.keys()] } }).select('name email partnerStatus').lean()).map((u) => [u._id.toString(), u]))
  const partners = [...balances.entries()]
    .map(([ownerId, months]) => {
      const locale = ownerLocale.get(ownerId) ?? { currency: defaultMarket().currency, timezone: defaultMarket().timezone }
      const current = monthOf(new Date(), locale.timezone)
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
        currency: locale.currency,
        /** Due (completed months) the partner still owes the platform; negative = platform owes. */
        dueMinor: due.reduce((s, m) => s + m.remainingMinor, 0),
        months: open,
      }
    })
    .filter((p) => p.months.length > 0)
    .sort((a, b) => b.dueMinor - a.dueMinor)

  const currencies = [...new Set(partners.map((p) => p.currency))].sort().map((currency) => {
    const group = partners.filter((p) => p.currency === currency)
    return {
      currency,
      owedToPlatformMinor: group.reduce((s, p) => s + Math.max(p.dueMinor, 0), 0),
      owedToPartnersMinor: group.reduce((s, p) => s + Math.max(-p.dueMinor, 0), 0),
    }
  })
  return { currentMonth: monthOf(new Date()), currencies, partners }
}

export async function recordPayment(
  input: { ownerId: string; month: string; amountMinor: number; direction: 'to_platform' | 'to_partner'; method: 'bank' | 'cash' | 'other'; paidAt?: Date; note?: string },
  actor: Actor,
) {
  monthWindow(input.month)
  if (input.month > monthOf(new Date())) throw ApiError.badRequest('Ne možeš evidentirati uplatu za budući mesec.', 'FUTURE_MONTH')
  const owner = await User.findById(input.ownerId).select('name email').lean()
  if (!owner || !(await Business.exists({ owner: owner._id }))) throw ApiError.notFound('Partner nije pronađen.')
  const { currency } = await partnerLocale(owner._id)
  const payment = await PartnerPayment.create({
    owner: owner._id,
    month: input.month,
    amountMinor: input.amountMinor,
    currency,
    direction: input.direction,
    method: input.method,
    paidAt: input.paidAt ?? new Date(),
    note: input.note,
    recordedBy: actor.id,
  })
  const amount = formatAmount(input.amountMinor, currency)
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
    summary: `Poništena uplata · ${payment.month} · ${formatAmount(payment.amountMinor, payment.currency ?? defaultMarket().currency)}`,
  })
}

export async function setCommission(businessId: string, rate: number | null) {
  const business = await Business.findByIdAndUpdate(businessId, rate == null ? { $unset: { commissionRate: 1 } } : { $set: { commissionRate: rate } }, { new: true })
  if (!business) throw ApiError.notFound('Lokal nije pronađen.')
  return { businessId: business.id as string, commissionRate: business.commissionRate ?? null }
}
