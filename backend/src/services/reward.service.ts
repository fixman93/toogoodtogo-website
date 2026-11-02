/**
 * Foodnesi Rewards: the catalog view and redemption of the two reward types
 * that aren't spent automatically — discount_percent (mints a one-off promo
 * code) and voucher (files a support ticket for the team to fulfill by hand).
 * free_bag redeems implicitly via reservation creation (reservation.service.ts
 * create()); bonus_points fires automatically in loyalty.service.ts.
 */
import { randomBytes } from 'node:crypto'
import { LoyaltyConfig, Promotion, Reward, RewardRedemption, User, type IReward } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import type { AdminRedemptionsQuery, AdminRewardCreateInput, AdminRewardUpdateInput, LoyaltyConfigInput } from '../validators/reward.validators.js'
import type { Actor } from './access.service.js'
import { audit } from './audit.service.js'
import { notify } from './notification.service.js'
import * as supportService from './support.service.js'

function mintCode() {
  return 'RWD-' + randomBytes(5).toString('base64url').replace(/[^A-Za-z0-9]/g, '').toUpperCase().slice(0, 8)
}

function serializeReward(reward: IReward & { _id: unknown }) {
  return {
    id: String(reward._id),
    key: reward.key,
    title: reward.title,
    description: reward.description ?? null,
    type: reward.type,
    thresholdPickups: reward.thresholdPickups,
    value: reward.value,
    voucherDescription: reward.voucherDescription ?? null,
    repeatable: reward.repeatable,
  }
}

/** Catalog + the signed-in user's progress and per-reward unlock/redeem state. */
export async function catalog(actor: Actor) {
  const user = await User.findById(actor.id).select('totalVerifiedPickups points').lean()
  const totalPickups = user?.totalVerifiedPickups ?? 0
  const rewards = await Reward.find({ isActive: true }).sort({ thresholdPickups: 1 }).lean()
  const redemptions = await RewardRedemption.find({ user: actor.id, reward: { $in: rewards.map((r) => r._id) } })
    .sort({ unlockedAt: -1 })
    .lean()
  const latestByReward = new Map<string, (typeof redemptions)[number]>()
  for (const r of redemptions) if (!latestByReward.has(r.reward.toString())) latestByReward.set(r.reward.toString(), r)
  const promoCodes = new Map(
    (await Promotion.find({ _id: { $in: redemptions.map((r) => r.promotion).filter(Boolean) } }).select('code').lean()).map((p) => [p._id.toString(), p.code]),
  )

  const items = rewards.map((reward) => {
    const base = serializeReward(reward)
    if (reward.type === 'bonus_points') {
      return { ...base, state: 'automatic' as const, redemptionId: null, promoCode: null, progress: { current: totalPickups % reward.thresholdPickups, target: reward.thresholdPickups } }
    }
    const redemption = latestByReward.get(String(reward._id))
    const state = !redemption ? (totalPickups >= reward.thresholdPickups ? 'unlocked' : 'locked') : redemption.status
    return {
      ...base,
      state,
      redemptionId: redemption ? String(redemption._id) : null,
      promoCode: redemption?.promotion ? promoCodes.get(redemption.promotion.toString()) ?? null : null,
      expiresAt: redemption?.expiresAt?.toISOString() ?? null,
      progress: { current: Math.min(totalPickups, reward.thresholdPickups), target: reward.thresholdPickups },
    }
  })
  return { totalVerifiedPickups: totalPickups, points: user?.points ?? 0, rewards: items }
}

export async function myRedemptions(actor: Actor) {
  const redemptions = await RewardRedemption.find({ user: actor.id }).sort({ unlockedAt: -1 }).limit(100).lean()
  const rewards = new Map((await Reward.find({ _id: { $in: redemptions.map((r) => r.reward) } }).lean()).map((r) => [String(r._id), r]))
  return redemptions.map((r) => ({
    id: String(r._id),
    reward: rewards.has(String(r.reward)) ? serializeReward(rewards.get(String(r.reward))!) : null,
    status: r.status,
    unlockedAt: r.unlockedAt.toISOString(),
    redeemedAt: r.redeemedAt?.toISOString() ?? null,
    expiresAt: r.expiresAt?.toISOString() ?? null,
  }))
}

/** Redeems a discount or voucher reward. free_bag/bonus_points reject here — see file header. */
export async function redeem(redemptionId: string, actor: Actor) {
  const redemption = await RewardRedemption.findOne({ _id: redemptionId, user: actor.id })
  if (!redemption) throw ApiError.notFound('Nagrada nije pronađena.')
  if (redemption.status !== 'unlocked') throw ApiError.conflict('Ova nagrada nije dostupna za iskorišćavanje.', 'REWARD_NOT_AVAILABLE')
  if (redemption.expiresAt && redemption.expiresAt < new Date()) throw ApiError.conflict('Rok za iskorišćavanje ove nagrade je istekao.', 'REWARD_EXPIRED')
  const reward = await Reward.findById(redemption.reward).lean()
  if (!reward) throw ApiError.notFound('Nagrada nije pronađena.')

  if (reward.type === 'discount_percent') {
    const promo = await Promotion.create({
      code: mintCode(),
      description: `Foodnesi Rewards: ${reward.title}`,
      discountType: 'percent',
      value: reward.value,
      maxUses: 1,
      perUserLimit: 1,
      createdBy: actor.id,
    })
    const updated = await RewardRedemption.findOneAndUpdate(
      { _id: redemption._id, status: 'unlocked' },
      { $set: { status: 'redeemed', redeemedAt: new Date(), promotion: promo._id } },
      { new: true },
    )
    if (!updated) {
      await Promotion.deleteOne({ _id: promo._id })
      throw ApiError.conflict('Ova nagrada je upravo iskorišćena.', 'REWARD_NOT_AVAILABLE')
    }
    return { type: 'discount_percent' as const, promoCode: promo.code, discountPercent: reward.value }
  }

  if (reward.type === 'voucher') {
    const updated = await RewardRedemption.findOneAndUpdate({ _id: redemption._id, status: 'unlocked' }, { $set: { status: 'redeemed', redeemedAt: new Date() } }, { new: true })
    if (!updated) throw ApiError.conflict('Ova nagrada je upravo iskorišćena.', 'REWARD_NOT_AVAILABLE')
    const user = await User.findById(actor.id).select('name email phone').lean()
    const ticket = await supportService.create(actor, {
      subject: `Foodnesi Rewards: ${reward.title}`,
      category: 'other',
      message: `${user?.name ?? 'Korisnik'} (${user?.email ?? ''}${user?.phone ? `, ${user.phone}` : ''}) je ostvario/la nagradu "${reward.title}"${
        reward.voucherDescription ? `: ${reward.voucherDescription}` : ''
      }. Molimo kontaktirati korisnika i dogovoriti realizaciju.`,
    })
    const team = await User.find({ role: { $in: ['admin', 'operations'] }, deletedAt: null }).select('_id').lean()
    void notify(
      team.map((u) => u._id),
      { type: 'reward', title: `Nagrada za realizaciju: ${reward.title}`, body: `${user?.name ?? 'Korisnik'} čeka kontakt tima.`, link: '/admin?tab=rewards' },
      { email: true },
    )
    return { type: 'voucher' as const, voucherDescription: reward.voucherDescription ?? null, ticketId: ticket.id }
  }

  throw ApiError.badRequest('Ova nagrada se ne iskorišćava na ovaj način.', 'REWARD_NOT_APPLICABLE')
}

// ---------------------------------------------------------------------------
// Admin: program config, reward catalog, redemption + fulfillment oversight.
// Anti-fraud/verification-rate stats already exist — see integrity.service.ts.

export async function getLoyaltyConfig() {
  const doc = await LoyaltyConfig.findById('default').lean()
  return { enabled: doc?.enabled ?? true, pointsPerBag: doc?.pointsPerBag ?? 10, updatedAt: doc?.updatedAt?.toISOString() ?? null }
}

export async function setLoyaltyConfig(input: LoyaltyConfigInput, actor: Actor) {
  const doc = await LoyaltyConfig.findByIdAndUpdate('default', { $set: { ...input, updatedBy: actor.id } }, { new: true, upsert: true, setDefaultsOnInsert: true })
  void audit(actor, { action: 'rewards.config', targetType: 'reward', targetId: 'default', summary: `Podešavanja Foodnesi Rewards: ${JSON.stringify(input)}` })
  return { enabled: doc.enabled, pointsPerBag: doc.pointsPerBag, updatedAt: doc.updatedAt.toISOString() }
}

export async function adminListRewards() {
  const rewards = await Reward.find().sort({ thresholdPickups: 1 }).lean()
  return rewards.map((r) => ({ ...serializeReward(r), isActive: r.isActive, createdAt: r.createdAt.toISOString() }))
}

export async function adminCreateReward(input: AdminRewardCreateInput, actor: Actor) {
  if (await Reward.exists({ key: input.key })) throw ApiError.conflict('Nagrada sa tim ključem već postoji.', 'REWARD_KEY_TAKEN')
  const reward = await Reward.create(input)
  void audit(actor, { action: 'reward.create', targetType: 'reward', targetId: reward._id, summary: `Nova nagrada: ${reward.title}` })
  return { ...serializeReward(reward), isActive: reward.isActive, createdAt: reward.createdAt.toISOString() }
}

export async function adminUpdateReward(id: string, input: AdminRewardUpdateInput, actor: Actor) {
  const reward = await Reward.findByIdAndUpdate(id, { $set: input }, { new: true })
  if (!reward) throw ApiError.notFound('Nagrada nije pronađena.')
  void audit(actor, { action: 'reward.update', targetType: 'reward', targetId: reward._id, summary: `Izmenjena nagrada: ${reward.title}` })
  return { ...serializeReward(reward), isActive: reward.isActive, createdAt: reward.createdAt.toISOString() }
}

export async function adminListRedemptions(query: AdminRedemptionsQuery) {
  const filter: Record<string, unknown> = {}
  if (query.status) filter.status = query.status
  if (query.needsFulfillment) {
    filter.status = 'redeemed'
    filter.fulfillmentNote = { $exists: false }
    filter.reward = { $in: (await Reward.find({ type: 'voucher' }).select('_id').lean()).map((r) => r._id) }
  }
  const redemptions = await RewardRedemption.find(filter).sort({ unlockedAt: -1 }).limit(200).lean()
  const [users, rewards] = await Promise.all([
    User.find({ _id: { $in: redemptions.map((r) => r.user) } }).select('name email phone').lean(),
    Reward.find({ _id: { $in: redemptions.map((r) => r.reward) } }).lean(),
  ])
  const userById = new Map(users.map((u) => [u._id.toString(), u]))
  const rewardById = new Map(rewards.map((r) => [r._id.toString(), r]))
  return redemptions.map((r) => ({
    id: String(r._id),
    user: userById.has(r.user.toString()) ? { id: r.user.toString(), name: userById.get(r.user.toString())!.name, email: userById.get(r.user.toString())!.email, phone: userById.get(r.user.toString())!.phone ?? null } : null,
    reward: rewardById.has(r.reward.toString()) ? serializeReward(rewardById.get(r.reward.toString())!) : null,
    status: r.status,
    unlockedAt: r.unlockedAt.toISOString(),
    redeemedAt: r.redeemedAt?.toISOString() ?? null,
    fulfillmentNote: r.fulfillmentNote ?? null,
  }))
}

export async function adminSetFulfillment(id: string, note: string, actor: Actor) {
  const redemption = await RewardRedemption.findByIdAndUpdate(id, { $set: { fulfillmentNote: note } }, { new: true })
  if (!redemption) throw ApiError.notFound('Nagrada nije pronađena.')
  void audit(actor, { action: 'reward.fulfillment', targetType: 'reward', targetId: redemption._id, summary: `Realizacija evidentirana: ${note}` })
  return { id: String(redemption._id), fulfillmentNote: redemption.fulfillmentNote ?? null }
}
