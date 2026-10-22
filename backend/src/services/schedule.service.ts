/**
 * Repeating offers: the partner describes the bag once with weekdays and a
 * pickup window; a job publishes a normal Offer for today and tomorrow. Plus
 * the "how many bags" suggestion from the last weeks' sales per weekday.
 */
import { Types } from 'mongoose'
import { MARKETS, marketFor } from '../config/markets.js'
import { Business, Offer, OfferSchedule, type IOfferSchedule, type OfferScheduleDoc } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { zonedTime } from '../utils/time.js'
import type { ScheduleInput } from '../validators/schedule.validators.js'
import { assertBusinessAccess, type Actor } from './access.service.js'
import { assertNotSuspended } from './partner-moderation.service.js'
import { assertCanPublishOffers } from './partner-onboarding.service.js'

/** Publish this many days ahead (0 = today, 1 = tomorrow). */
const DAYS_AHEAD = [0, 1]
/** Weeks of history behind a suggestion. */
const HISTORY_WEEKS = 8

const ISO_DAY: Record<string, number> = { Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6, Sun: 7 }

/** Local calendar date ("YYYY-MM-DD") and ISO weekday `dayOffset` days from `now`. */
function localDay(dayOffset: number, timeZone: string, now = new Date()) {
  const noon = zonedTime(dayOffset, '12:00', timeZone, now)
  const date = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(noon)
  const weekday = ISO_DAY[new Intl.DateTimeFormat('en-US', { timeZone, weekday: 'short' }).format(noon)]
  return { date, weekday }
}

function serialize(s: OfferScheduleDoc | (IOfferSchedule & { _id: Types.ObjectId }), businessName?: string) {
  return {
    id: s._id.toString(),
    businessId: s.business.toString(),
    businessName,
    title: s.title,
    description: s.description,
    category: s.category,
    imageUrl: s.imageUrl,
    tags: s.tags,
    contentType: s.contentType,
    contents: s.contents,
    allergens: s.allergens,
    priceMinor: s.priceMinor,
    originalPriceMinor: s.originalPriceMinor,
    priceDrop: s.priceDrop ? { time: s.priceDrop.time, priceMinor: s.priceDrop.priceMinor } : null,
    quantity: s.quantity,
    maxPerReservation: s.maxPerReservation ?? null,
    startTime: s.startTime,
    endTime: s.endTime,
    weekdays: [...s.weekdays].sort(),
    isActive: s.isActive,
    lastDate: s.lastDate ?? null,
    createdAt: s.createdAt.toISOString(),
  }
}

function checkInput(input: Partial<ScheduleInput>, merged: Pick<IOfferSchedule, 'priceMinor' | 'originalPriceMinor' | 'startTime' | 'endTime' | 'priceDrop'>) {
  if (merged.priceMinor >= merged.originalPriceMinor) throw ApiError.badRequest('Cena mora biti niža od redovne.', 'INVALID_PRICE')
  if (merged.endTime <= merged.startTime) throw ApiError.badRequest('Kraj preuzimanja mora biti posle početka (isti dan).', 'INVALID_PICKUP')
  if (merged.priceDrop) {
    if (merged.priceDrop.priceMinor >= merged.priceMinor) throw ApiError.badRequest('Sniženje mora biti niže od osnovne cene.', 'INVALID_PRICE_DROP')
    if (merged.priceDrop.time >= merged.endTime) throw ApiError.badRequest('Sniženje mora početi pre kraja preuzimanja.', 'INVALID_PRICE_DROP')
  }
  void input
}

/**
 * Publish the schedule's offers for today/tomorrow that don't exist yet.
 * `lastDate` is claimed atomically, so two servers never publish the same day twice.
 */
async function publish(schedule: OfferScheduleDoc, now = new Date()) {
  const business = await Business.findById(schedule.business)
  if (!business || business.deletedAt || !business.isActive || business.suspended) return 0
  // Partner rules not accepted (yet): wait, don't publish.
  if (!(await assertCanPublishOffers(business.owner).then(() => true, () => false))) return 0
  const market = MARKETS[business.address.countryCode] ?? marketFor(undefined)
  let created = 0
  for (const offset of DAYS_AHEAD) {
    const { date, weekday } = localDay(offset, business.timezone, now)
    if (!schedule.weekdays.includes(weekday)) continue
    const pickupStart = zonedTime(offset, schedule.startTime, business.timezone, now)
    const pickupEnd = zonedTime(offset, schedule.endTime, business.timezone, now)
    if (pickupEnd <= now) continue
    const claimed = await OfferSchedule.findOneAndUpdate(
      { _id: schedule._id, isActive: true, $or: [{ lastDate: { $exists: false } }, { lastDate: null }, { lastDate: { $lt: date } }] },
      { $set: { lastDate: date } },
      { new: true },
    )
    if (!claimed) continue
    schedule.lastDate = date
    await Offer.create({
      business: business._id,
      schedule: schedule._id,
      title: schedule.title,
      description: schedule.description,
      category: schedule.category,
      imageUrl: schedule.imageUrl,
      tags: schedule.tags,
      contentType: schedule.contentType,
      contents: schedule.contents,
      allergens: schedule.allergens,
      priceMinor: schedule.priceMinor,
      originalPriceMinor: schedule.originalPriceMinor,
      ...(schedule.priceDrop ? { priceDrop: { at: zonedTime(offset, schedule.priceDrop.time, business.timezone, now), priceMinor: schedule.priceDrop.priceMinor } } : {}),
      currency: business.currency,
      timezone: business.timezone,
      quantityTotal: schedule.quantity,
      quantityAvailable: schedule.quantity,
      maxPerReservation: Math.min(schedule.maxPerReservation ?? market.maxQuantityPerReservation, schedule.quantity),
      pickupStart,
      pickupEnd,
      location: business.location,
      businessName: business.name,
      city: business.address.city,
    })
    created++
  }
  return created
}

/** Job: publish due offers of every active schedule. */
export async function publishDue(now = new Date()) {
  const schedules = await OfferSchedule.find({ isActive: true })
  let created = 0
  for (const s of schedules) {
    try {
      created += await publish(s, now)
    } catch (error) {
      console.error(`Schedule ${s.id} failed`, error)
    }
  }
  return created
}

export async function list(actor: Actor, businessId?: string) {
  const businesses = businessId ? [await assertBusinessAccess(businessId, actor)] : await Business.find({ owner: actor.id, deletedAt: null }).select('name')
  const names = new Map(businesses.map((b) => [b._id.toString(), b.name]))
  const items = await OfferSchedule.find({ business: { $in: [...names.keys()] } }).sort({ isActive: -1, startTime: 1 })
  return items.map((s) => serialize(s, names.get(s.business.toString())))
}

export async function create(input: ScheduleInput, actor: Actor) {
  const business = await assertBusinessAccess(input.businessId, actor)
  await assertNotSuspended(business)
  await assertCanPublishOffers(business.owner)
  checkInput(input, { ...input, priceDrop: input.priceDrop ?? undefined })
  const { businessId: _businessId, priceDrop, ...fields } = input
  const schedule = await OfferSchedule.create({
    ...fields,
    ...(priceDrop ? { priceDrop } : {}),
    category: input.category ?? business.category,
    business: business._id,
    createdBy: actor.id,
  })
  await publish(schedule)
  return serialize(schedule, business.name)
}

export async function update(id: string, input: Partial<ScheduleInput> & { isActive?: boolean }, actor: Actor) {
  const schedule = await OfferSchedule.findById(id)
  if (!schedule) throw ApiError.notFound('Ponavljajuća ponuda nije pronađena.')
  const business = await assertBusinessAccess(schedule.business, actor)
  if (input.isActive) {
    await assertNotSuspended(business)
    await assertCanPublishOffers(business.owner)
  }
  const { businessId: _businessId, priceDrop, ...fields } = input
  schedule.set(fields)
  if (priceDrop === null) schedule.set('priceDrop', undefined)
  else if (priceDrop) schedule.set('priceDrop', priceDrop)
  checkInput(input, schedule)
  await schedule.save()
  // Already published offers stay as they are (edit them one by one); new days use the new settings.
  if (schedule.isActive) await publish(schedule)
  return serialize(schedule, business.name)
}

/** Stops repeating; offers already published stay online. */
export async function remove(id: string, actor: Actor) {
  const schedule = await OfferSchedule.findById(id)
  if (!schedule) throw ApiError.notFound('Ponavljajuća ponuda nije pronađena.')
  await assertBusinessAccess(schedule.business, actor)
  await schedule.deleteOne()
}

/**
 * Per weekday over the last weeks: bags offered vs sold, how often it sold
 * out, and a suggested number of bags.
 * - sold (almost) everything → offer ~20% more;
 * - sold less than 60% → offer a little more than was sold;
 * - otherwise keep the usual amount.
 */
export async function recommendation(businessId: string, actor: Actor) {
  const business = await assertBusinessAccess(businessId, actor)
  const now = new Date()
  const rows = await Offer.aggregate<{ _id: number; days: number; offered: number; sold: number; soldOut: number }>([
    {
      $match: {
        business: new Types.ObjectId(business.id as string),
        pickupEnd: { $lt: now, $gte: new Date(now.getTime() - HISTORY_WEEKS * 7 * 86_400_000) },
        status: { $ne: 'archived' },
      },
    },
    { $addFields: { weekday: { $isoDayOfWeek: { date: '$pickupStart', timezone: business.timezone } }, day: { $dateToString: { format: '%Y-%m-%d', date: '$pickupStart', timezone: business.timezone } } } },
    // Several offers on one day count as one day.
    { $group: { _id: { weekday: '$weekday', day: '$day' }, offered: { $sum: '$quantityTotal' }, sold: { $sum: '$reservedCount' }, left: { $sum: '$quantityAvailable' } } },
    { $group: { _id: '$_id.weekday', days: { $sum: 1 }, offered: { $sum: '$offered' }, sold: { $sum: '$sold' }, soldOut: { $sum: { $cond: [{ $eq: ['$left', 0] }, 1, 0] } } } },
  ])
  const byDay = new Map(rows.map((r) => [r._id, r]))
  return {
    weeks: HISTORY_WEEKS,
    days: [1, 2, 3, 4, 5, 6, 7].map((weekday) => {
      const r = byDay.get(weekday)
      if (!r || r.days === 0) return { weekday, days: 0, avgOffered: null, avgSold: null, sellThrough: null, soldOutDays: 0, suggested: null }
      const avgOffered = r.offered / r.days
      const avgSold = r.sold / r.days
      const sellThrough = r.offered ? r.sold / r.offered : 0
      const suggested =
        sellThrough >= 0.95 ? Math.ceil(avgOffered * 1.2) : sellThrough < 0.6 ? Math.max(1, Math.ceil(avgSold * 1.1)) : Math.round(avgOffered)
      return { weekday, days: r.days, avgOffered: Math.round(avgOffered * 10) / 10, avgSold: Math.round(avgSold * 10) / 10, sellThrough: Math.round(sellThrough * 100) / 100, soldOutDays: r.soldOut, suggested }
    }),
  }
}
