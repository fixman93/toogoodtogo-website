/**
 * Loyalty: points for every rescued bag and a bonus for inviting friends.
 * Levels are motivational (no cash value while payments happen in the shop).
 */
import { randomBytes } from 'node:crypto'
import type { Types } from 'mongoose'
import { marketFor } from '../config/markets.js'
import { Business, Reservation, User } from '../models/index.js'
import { notify } from './notification.service.js'

export const POINTS_PER_BAG = 10
export const REFERRAL_BONUS = 50
/** Weekly challenge: rescue this many bags in one week (Mon–Sun)… */
export const WEEKLY_GOAL = 3
/** …and their points count double. */
export const WEEKLY_BONUS = WEEKLY_GOAL * POINTS_PER_BAG
/** Every 4 weeks in a row with at least one rescued bag. */
export const STREAK_STEP = 4
export const STREAK_BONUS = 40
/** Impact estimates per rescued bag (same order of magnitude as other food-waste apps). */
export const KG_PER_BAG = 1
export const CO2_PER_KG = 2.5

// ---------------------------------------------------------------------------
// Weeks (ISO, Monday first) in a timezone.

function localYmd(date: Date, timeZone: string) {
  const [y, m, d] = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit', day: '2-digit' }).format(date).split('-').map(Number)
  return { y, m, d }
}

/** "2026-W42" for the local date of `date`. */
export function isoWeek(date: Date, timeZone: string) {
  const { y, m, d } = localYmd(date, timeZone)
  const day = new Date(Date.UTC(y, m - 1, d))
  const weekday = day.getUTCDay() || 7
  day.setUTCDate(day.getUTCDate() + 4 - weekday)
  const yearStart = Date.UTC(day.getUTCFullYear(), 0, 1)
  const week = Math.ceil(((day.getTime() - yearStart) / 86_400_000 + 1) / 7)
  return `${day.getUTCFullYear()}-W${String(week).padStart(2, '0')}`
}

/** Weeks in a row (ending this week, or last week if nothing yet this week) with a pickup. */
export function streakWeeks(pickups: Date[], timeZone: string, now = new Date()) {
  const weeks = new Set(pickups.map((d) => isoWeek(d, timeZone)))
  const start = weeks.has(isoWeek(now, timeZone)) ? 0 : 1
  let streak = 0
  while (weeks.has(isoWeek(new Date(now.getTime() - (start + streak) * 7 * 86_400_000), timeZone))) streak++
  return streak
}

export const LEVELS = [
  { key: 'beginner', name: 'Početnik', min: 0 },
  { key: 'saver', name: 'Spasilac', min: 100 },
  { key: 'hero', name: 'Heroj hrane', min: 500 },
  { key: 'legend', name: 'Legenda', min: 1500 },
] as const

export function levelFor(points: number) {
  const index = LEVELS.reduce((found, level, i) => (points >= level.min ? i : found), 0)
  const next = LEVELS[index + 1]
  return { key: LEVELS[index].key, name: LEVELS[index].name, nextAt: next?.min ?? null, nextName: next?.name ?? null }
}

/** Generates a code on first use (older accounts don't have one yet). */
export async function ensureReferralCode(userId: string | Types.ObjectId) {
  const user = await User.findById(userId).select('referralCode')
  if (!user) return null
  if (user.referralCode) return user.referralCode
  for (let i = 0; i < 5; i++) {
    const code = randomBytes(4).toString('base64url').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 6).padEnd(6, 'Z')
    const res = await User.updateOne({ _id: user._id, referralCode: null }, { $set: { referralCode: code } }).catch(() => null)
    if (res?.modifiedCount) return code
  }
  return null
}

export async function findReferrer(code?: string) {
  if (!code) return null
  return User.findOne({ referralCode: code.trim().toUpperCase(), deletedAt: null }).select('_id')
}

/** Weekly challenge and streak bonuses, each paid once. */
async function rewardChallenges(userId: Types.ObjectId) {
  const user = await User.findById(userId).select('countryCode challengeWeek streakRewarded')
  if (!user) return
  const timeZone = marketFor(user.countryCode).timezone
  const now = new Date()
  const pickups = await Reservation.find({ user: userId, status: 'collected', collectedAt: { $gte: new Date(now.getTime() - 400 * 86_400_000) } })
    .select('collectedAt quantity')
    .lean()
  const week = isoWeek(now, timeZone)
  const weekBags = pickups.filter((r) => r.collectedAt && isoWeek(r.collectedAt, timeZone) === week).reduce((n, r) => n + r.quantity, 0)
  if (weekBags >= WEEKLY_GOAL && user.challengeWeek !== week) {
    const won = await User.updateOne({ _id: userId, challengeWeek: { $ne: week } }, { $set: { challengeWeek: week }, $inc: { points: WEEKLY_BONUS } })
    if (won.modifiedCount) {
      void notify([userId], { type: 'challenge', title: `Izazov ispunjen! +${WEEKLY_BONUS} bodova`, body: `Spasio/la si ${WEEKLY_GOAL} kese ove nedelje – bodovi su duplirani.`, link: '/impact' })
    }
  }
  const streak = streakWeeks(pickups.map((r) => r.collectedAt!).filter(Boolean), timeZone, now)
  // A broken streak starts counting again from zero.
  const rewarded = streak < (user.streakRewarded ?? 0) ? 0 : (user.streakRewarded ?? 0)
  if (rewarded !== (user.streakRewarded ?? 0)) await User.updateOne({ _id: userId }, { $set: { streakRewarded: 0 } })
  if (streak >= STREAK_STEP && streak % STREAK_STEP === 0 && streak > rewarded) {
    const won = await User.updateOne({ _id: userId, streakRewarded: { $lt: streak } }, { $set: { streakRewarded: streak }, $inc: { points: STREAK_BONUS } })
    if (won.modifiedCount) {
      void notify([userId], { type: 'challenge', title: `${streak} nedelja zaredom! +${STREAK_BONUS} bodova`, body: 'Svake nedelje spasiš bar jednu kesu. Samo tako!', link: '/impact' })
    }
  }
}

/** Called after a pickup is confirmed. */
export async function rewardPickup(userId: Types.ObjectId, bags: number) {
  try {
    await User.updateOne({ _id: userId }, { $inc: { points: bags * POINTS_PER_BAG } })
    await rewardChallenges(userId)
    // Referral bonus on the invited friend's first pickup (once).
    const user = await User.findOneAndUpdate(
      { _id: userId, referredBy: { $ne: null }, referralRewarded: false },
      { $set: { referralRewarded: true } },
      { new: true },
    )
    if (!user?.referredBy) return
    const firstPickup = (await Reservation.countDocuments({ user: userId, status: 'collected' })) <= 1
    if (!firstPickup) return
    await User.updateMany({ _id: { $in: [userId, user.referredBy] } }, { $inc: { points: REFERRAL_BONUS } })
    void notify([user.referredBy], {
      type: 'reward',
      title: `+${REFERRAL_BONUS} bodova!`,
      body: `${user.name} je preuzeo prvu kesu uz tvoju preporuku.`,
      link: '/profile',
    })
  } catch (error) {
    console.error('Loyalty reward failed', error)
  }
}

/** Discount on the first bag for a user who signed up with a friend's code (paid by the platform); null when used. */
export async function welcomeDiscountPercent(userId: string | Types.ObjectId) {
  const user = await User.findById(userId).select('referredBy countryCode').lean()
  if (!user?.referredBy) return null
  if (await Reservation.exists({ user: userId, status: { $ne: 'cancelled' } })) return null
  return marketFor(user.countryCode).referralDiscountPercent
}

// ---------------------------------------------------------------------------
// "Moj uticaj": totals, this week, streak, badges and the yearly recap.

const BADGES = [
  { key: 'first', test: (s: Stats) => s.bags >= 1 },
  { key: 'ten', test: (s: Stats) => s.bags >= 10 },
  { key: 'fifty', test: (s: Stats) => s.bags >= 50 },
  { key: 'explorer', test: (s: Stats) => s.places >= 5 },
  { key: 'early', test: (s: Stats) => s.early > 0 },
  { key: 'night', test: (s: Stats) => s.night > 0 },
  { key: 'streak', test: (s: Stats) => s.bestStreak >= STREAK_STEP },
] as const

interface Stats {
  bags: number
  places: number
  early: number
  night: number
  bestStreak: number
}

type Pickup = { collectedAt: Date; quantity: number; totalMinor: number; originalUnitPriceMinor: number; currency: string; business: Types.ObjectId; timezone: string; pickupStart: Date }

function summarize(rows: Pickup[]) {
  const bags = rows.reduce((n, r) => n + r.quantity, 0)
  const saved = new Map<string, number>()
  for (const r of rows) saved.set(r.currency, (saved.get(r.currency) ?? 0) + r.originalUnitPriceMinor * r.quantity - r.totalMinor)
  // Main currency = where most was saved; others are listed too.
  const savings = [...saved.entries()].map(([currency, minor]) => ({ currency, minor })).sort((a, b) => b.minor - a.minor)
  return { bags, kgFood: bags * KG_PER_BAG, co2Kg: Math.round(bags * KG_PER_BAG * CO2_PER_KG * 10) / 10, savings }
}

const localHour = (date: Date, timeZone: string) => Number(new Intl.DateTimeFormat('en-US', { timeZone, hour: '2-digit', hourCycle: 'h23' }).format(date))

export async function impact(userId: string, year?: number) {
  const user = await User.findById(userId).select('countryCode challengeWeek').lean()
  const timeZone = marketFor(user?.countryCode).timezone
  const now = new Date()
  const rows = (await Reservation.find({ user: userId, status: 'collected', collectedAt: { $ne: null } })
    .select('collectedAt quantity totalMinor originalUnitPriceMinor currency business timezone pickupStart')
    .lean()) as Pickup[]

  const all = summarize(rows)
  const week = isoWeek(now, timeZone)
  const weekBags = rows.filter((r) => isoWeek(r.collectedAt, timeZone) === week).reduce((n, r) => n + r.quantity, 0)
  const dates = rows.map((r) => r.collectedAt)
  const streak = streakWeeks(dates, timeZone, now)
  // Best streak ever (for the badge).
  let bestStreak = 0
  for (const d of dates) bestStreak = Math.max(bestStreak, streakWeeks(dates.filter((x) => x <= d), timeZone, d))
  const stats: Stats = {
    bags: all.bags,
    places: new Set(rows.map((r) => r.business.toString())).size,
    early: rows.filter((r) => localHour(r.pickupStart, r.timezone) < 9).length,
    night: rows.filter((r) => localHour(r.pickupStart, r.timezone) >= 21).length,
    bestStreak,
  }

  // Yearly recap ("Foodnesi godina").
  const recapYear = year ?? Number(new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric' }).format(now))
  const inYear = rows.filter((r) => localYmd(r.collectedAt, timeZone).y === recapYear)
  const perBusiness = new Map<string, number>()
  for (const r of inYear) perBusiness.set(r.business.toString(), (perBusiness.get(r.business.toString()) ?? 0) + r.quantity)
  const topId = [...perBusiness.entries()].sort((a, b) => b[1] - a[1])[0]?.[0]
  const top = topId ? await Business.findById(topId).select('name category logoUrl').lean() : null
  const perMonth = Array.from({ length: 12 }, (_, i) => inYear.filter((r) => localYmd(r.collectedAt, timeZone).m === i + 1).reduce((n, r) => n + r.quantity, 0))
  const categories = new Map<string, number>()
  if (inYear.length) {
    const cats = new Map((await Business.find({ _id: { $in: [...perBusiness.keys()] } }).select('category').lean()).map((b) => [b._id.toString(), b.category]))
    for (const r of inYear) {
      const c = cats.get(r.business.toString())
      if (c) categories.set(c, (categories.get(c) ?? 0) + r.quantity)
    }
  }
  const first = inYear.map((r) => r.collectedAt).sort((a, b) => a.getTime() - b.getTime())[0]

  return {
    ...all,
    places: stats.places,
    week: { bags: weekBags, goal: WEEKLY_GOAL, bonus: WEEKLY_BONUS, done: user?.challengeWeek === week },
    streak: { weeks: streak, step: STREAK_STEP, bonus: STREAK_BONUS, nextAt: Math.ceil((streak + 1) / STREAK_STEP) * STREAK_STEP },
    badges: BADGES.map((b) => ({ key: b.key, earned: b.test(stats) })),
    recap: {
      year: recapYear,
      ...summarize(inYear),
      places: perBusiness.size,
      topPlace: top ? { id: top._id.toString(), name: top.name, logoUrl: top.logoUrl ?? null, bags: perBusiness.get(topId!) ?? 0 } : null,
      topCategory: [...categories.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null,
      perMonth,
      bestMonth: perMonth.some((n) => n > 0) ? perMonth.indexOf(Math.max(...perMonth)) + 1 : null,
      firstPickup: first?.toISOString() ?? null,
    },
  }
}
