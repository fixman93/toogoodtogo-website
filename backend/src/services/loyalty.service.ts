/**
 * Loyalty: points for every rescued bag and a bonus for inviting friends.
 * Levels are motivational (no cash value while payments happen in the shop).
 */
import { randomBytes } from 'node:crypto'
import type { Types } from 'mongoose'
import { Reservation, User } from '../models/index.js'
import { notify } from './notification.service.js'

export const POINTS_PER_BAG = 10
export const REFERRAL_BONUS = 50

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

/** Called after a pickup is confirmed. */
export async function rewardPickup(userId: Types.ObjectId, bags: number) {
  try {
    await User.updateOne({ _id: userId }, { $inc: { points: bags * POINTS_PER_BAG } })
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
