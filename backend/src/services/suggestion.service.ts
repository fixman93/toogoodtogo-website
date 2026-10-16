/**
 * "Pametan predlog": how many bags to publish, based on what this location
 * sold on the same weekday in recent weeks (simple, explainable statistics).
 */
import type { Types } from 'mongoose'
import { env } from '../config/env.js'
import { getMarket } from '../config/markets.js'
import { Offer, Reservation } from '../models/index.js'
import { zonedTime } from '../utils/time.js'
import { assertBusinessAccess, type Actor } from './access.service.js'

const WEEKS = 8

export async function suggestQuantity(businessId: string, date: string, actor: Actor) {
  const business = await assertBusinessAccess(businessId, actor)
  const tz = getMarket(env.DEFAULT_MARKET).timezone
  const [y, m, d] = date.split('-').map(Number)
  const noon = new Date(Date.UTC(y, m - 1, d, 12))

  const weeks: { sold: number; total: number }[] = []
  for (let w = 1; w <= WEEKS; w++) {
    const day = new Date(noon.getTime() - w * 7 * 86_400_000)
    const start = zonedTime(0, '00:00', tz, day)
    const end = zonedTime(1, '00:00', tz, day)
    const offers = await Offer.find({ business: business._id, pickupStart: { $gte: start, $lt: end } }).select('_id quantityTotal').lean()
    if (!offers.length) continue
    const [sold] = await Reservation.aggregate<{ bags: number }>([
      { $match: { offer: { $in: offers.map((o) => o._id as Types.ObjectId) }, status: { $ne: 'cancelled' } } },
      { $group: { _id: null, bags: { $sum: '$quantity' } } },
    ])
    weeks.push({ sold: sold?.bags ?? 0, total: offers.reduce((s, o) => s + o.quantityTotal, 0) })
  }

  if (weeks.length < 2) return { suggestedQuantity: null, basedOnWeeks: weeks.length }
  const avgSold = weeks.reduce((s, w) => s + w.sold, 0) / weeks.length
  const avgTotal = weeks.reduce((s, w) => s + w.total, 0) / weeks.length
  const sellThrough = avgTotal ? avgSold / avgTotal : 0
  // Sold out almost every time → offer a bit more; lots left over → a bit less.
  const factor = sellThrough >= 0.9 ? 1.25 : sellThrough < 0.5 ? 0.9 : 1
  return {
    suggestedQuantity: Math.max(1, Math.round(avgSold * factor)),
    basedOnWeeks: weeks.length,
    avgSold: Math.round(avgSold * 10) / 10,
    avgTotal: Math.round(avgTotal * 10) / 10,
    sellThrough: Math.round(sellThrough * 100),
  }
}
