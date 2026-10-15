/**
 * Partner sales report for one local day: per location and per offer, how
 * many bags were sold (reserved), collected, are still waiting, were not
 * picked up or cancelled — and how many are left in stock.
 */
import type { Types } from 'mongoose'
import { env } from '../config/env.js'
import { getMarket } from '../config/markets.js'
import { Business, Offer, Reservation } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { zonedTime } from '../utils/time.js'
import { assertBusinessAccess, type Actor } from './access.service.js'

interface Counts {
  bagsTotal: number
  bagsRemaining: number
  bagsSold: number
  bagsCollected: number
  bagsPending: number
  bagsNoShow: number
  bagsCancelled: number
  revenueMinor: number
  expectedRevenueMinor: number
}

const emptyCounts = (): Counts => ({
  bagsTotal: 0,
  bagsRemaining: 0,
  bagsSold: 0,
  bagsCollected: 0,
  bagsPending: 0,
  bagsNoShow: 0,
  bagsCancelled: 0,
  revenueMinor: 0,
  expectedRevenueMinor: 0,
})

function add(target: Counts, source: Counts) {
  for (const key of Object.keys(target) as (keyof Counts)[]) target[key] += source[key]
}

/** UTC range of a local calendar day ("YYYY-MM-DD") in `tz`. */
function dayRange(date: string | undefined, tz: string) {
  const now = new Date()
  if (!date) return { date: new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(now), start: zonedTime(0, '00:00', tz, now), end: zonedTime(1, '00:00', tz, now) }
  // Anchor at local noon of that day, then take its midnight boundaries.
  const [y, m, d] = date.split('-').map(Number)
  const noon = new Date(Date.UTC(y, m - 1, d, 12))
  if (Number.isNaN(noon.getTime())) throw ApiError.badRequest('Neispravan datum.')
  return { date, start: zonedTime(0, '00:00', tz, noon), end: zonedTime(1, '00:00', tz, noon) }
}

export async function partnerSales(actor: Actor, query: { date?: string; businessId?: string }) {
  const market = getMarket(env.DEFAULT_MARKET)
  const { date, start, end } = dayRange(query.date, market.timezone)

  const businesses = query.businessId
    ? [await assertBusinessAccess(query.businessId, actor)]
    : await Business.find({ owner: actor.id, deletedAt: null }).sort({ name: 1 })
  const businessIds = businesses.map((b) => b._id)

  // Offers whose pickup window starts on that day (including deleted/archived ones: sales still count).
  const offers = await Offer.find({ business: { $in: businessIds }, pickupStart: { $gte: start, $lt: end } }).sort({ pickupStart: 1 })
  const rows = await Reservation.aggregate<{ _id: { offer: Types.ObjectId; status: string }; bags: number; amount: number }>([
    { $match: { offer: { $in: offers.map((o) => o._id) } } },
    { $group: { _id: { offer: '$offer', status: '$status' }, bags: { $sum: '$quantity' }, amount: { $sum: '$totalMinor' } } },
  ])
  const byOffer = new Map<string, { status: string; bags: number; amount: number }[]>()
  for (const r of rows) {
    const key = r._id.offer.toString()
    byOffer.set(key, [...(byOffer.get(key) ?? []), { status: r._id.status, bags: r.bags, amount: r.amount }])
  }

  const now = Date.now()
  const totals = emptyCounts()
  const perBusiness = businesses.map((business) => {
    const businessTotals = emptyCounts()
    const offerRows = offers
      .filter((o) => o.business.equals(business._id))
      .map((o) => {
        const counts = emptyCounts()
        counts.bagsTotal = o.quantityTotal
        counts.bagsRemaining = o.quantityAvailable
        for (const r of byOffer.get(o.id) ?? []) {
          if (r.status === 'collected') {
            counts.bagsCollected += r.bags
            counts.revenueMinor += r.amount
          } else if (r.status === 'confirmed' || r.status === 'pending_payment') {
            counts.bagsPending += r.bags
            counts.expectedRevenueMinor += r.amount
          } else if (r.status === 'expired') counts.bagsNoShow += r.bags
          else if (r.status === 'cancelled') counts.bagsCancelled += r.bags
        }
        counts.bagsSold = counts.bagsCollected + counts.bagsPending + counts.bagsNoShow
        add(businessTotals, counts)
        return {
          id: o.id,
          title: o.title,
          pickupStart: o.pickupStart.toISOString(),
          pickupEnd: o.pickupEnd.toISOString(),
          timezone: o.timezone,
          priceMinor: o.priceMinor,
          currency: o.currency,
          status: o.status === 'archived' ? 'archived' : o.pickupEnd.getTime() <= now ? 'expired' : o.status,
          ...counts,
        }
      })
    add(totals, businessTotals)
    return { id: business.id, name: business.name, address: business.address, ...businessTotals, offers: offerRows }
  })

  return { date, timezone: market.timezone, currency: market.currency, ...totals, businesses: perBusiness }
}
