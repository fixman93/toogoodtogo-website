import { Types } from 'mongoose'
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { resetTestDb, startTestDb, stopTestDb } from '../test/db.js'
import { makeCustomer } from '../test/fixtures.js'
import { REWARD_CATALOG } from '../seed/data.js'
import { Reward, RewardRedemption, User } from '../models/index.js'
import { rewardPickup } from './loyalty.service.js'

describe('loyalty.service — Foodnesi Rewards unlocking', () => {
  beforeAll(startTestDb, 60_000)
  beforeEach(() => Reward.insertMany(REWARD_CATALOG))
  afterEach(resetTestDb)
  afterAll(stopTestDb)

  it('unlocks exactly the right rewards, exactly once each, for pickups 1 through 30', async () => {
    const { user } = await makeCustomer()
    for (let i = 0; i < 30; i++) {
      await rewardPickup(user._id, 1, new Types.ObjectId())
    }

    const redemptions = await RewardRedemption.find({ user: user._id }).lean()
    const byKey = new Map(redemptions.map((r) => [r.rewardKey, r]))
    // One redemption each for the four non-repeatable catalog rewards — never duplicated.
    expect(byKey.has('discount_10pct_5')).toBe(true)
    expect(byKey.has('free_bag_10')).toBe(true)
    expect(byKey.has('free_bag_20_a')).toBe(true)
    expect(byKey.has('free_bag_20_b')).toBe(true)
    expect(byKey.has('vip_voucher_30')).toBe(true)
    expect(redemptions).toHaveLength(5) // no duplicates across 30 pickups

    // The repeatable bonus (every 3rd pickup: 3,6,...,30 = 10 times, 50pts each) adds on top of the 10/bag base.
    const finalUser = await User.findById(user._id).select('points totalVerifiedPickups').lean()
    expect(finalUser?.totalVerifiedPickups).toBe(30)
    expect(finalUser?.points).toBe(30 * 10 + 10 * 50)
  })

  it('unlocks nothing before the threshold is reached', async () => {
    const { user } = await makeCustomer()
    for (let i = 0; i < 4; i++) await rewardPickup(user._id, 1, new Types.ObjectId())
    expect(await RewardRedemption.countDocuments({ user: user._id })).toBe(0)
    const updated = await User.findById(user._id).select('totalVerifiedPickups').lean()
    expect(updated?.totalVerifiedPickups).toBe(4)
  })

  it('a disabled program does not unlock rewards, even past a threshold', async () => {
    const { LoyaltyConfig } = await import('../models/index.js')
    await LoyaltyConfig.create({ _id: 'default', enabled: false })
    const { user } = await makeCustomer()
    for (let i = 0; i < 10; i++) await rewardPickup(user._id, 1, new Types.ObjectId())
    expect(await RewardRedemption.countDocuments({ user: user._id })).toBe(0)
    // Points/pickup count still accrue — only the catalog unlocking is gated by the kill switch.
    const updated = await User.findById(user._id).select('totalVerifiedPickups').lean()
    expect(updated?.totalVerifiedPickups).toBe(10)
  })
})
