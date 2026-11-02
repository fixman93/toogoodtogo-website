import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest'
import { resetTestDb, startTestDb, stopTestDb } from '../test/db.js'
import { makeCustomer, makeOffer, makePartner } from '../test/fixtures.js'
import { REWARD_CATALOG } from '../seed/data.js'
import { Promotion, Reward, RewardRedemption } from '../models/index.js'
import * as reservationService from './reservation.service.js'
import * as rewardService from './reward.service.js'
import * as statementService from './statement.service.js'

async function unlockedRedemption(userId: string, key: string) {
  const reward = await Reward.findOne({ key }).lean()
  return RewardRedemption.create({ user: userId, reward: reward!._id, rewardKey: key, unlockedAtPickupCount: reward!.thresholdPickups })
}

function currentMonth(timeZone: string) {
  const [y, m] = new Intl.DateTimeFormat('en-CA', { timeZone, year: 'numeric', month: '2-digit' }).format(new Date()).split('-')
  return `${y}-${m}`
}

describe('reward.service — redemption', () => {
  beforeAll(startTestDb, 60_000)
  beforeEach(() => Reward.insertMany(REWARD_CATALOG))
  afterEach(resetTestDb)
  afterAll(stopTestDb)

  it('discount_percent redemption mints a one-off promo usable through the normal promoCode path', async () => {
    const { user: customer, actor: customerActor } = await makeCustomer()
    const { business } = await makePartner()
    const offer = await makeOffer(business, { priceMinor: 30000 })
    const redemption = await unlockedRedemption(customer.id as string, 'discount_10pct_5')

    const result = await rewardService.redeem(redemption.id as string, customerActor)
    expect(result.type).toBe('discount_percent')
    if (result.type !== 'discount_percent') throw new Error('unreachable')

    const reservation = await reservationService.create({ offerId: offer.id, quantity: 1, fulfillment: 'pickup', promoCode: result.promoCode }, customerActor)
    expect(reservation.discountMinor).toBe(3000) // 10% of 30000
    expect(reservation.totalMinor).toBe(27000)

    const promo = await Promotion.findOne({ code: result.promoCode }).lean()
    expect(promo?.usesCount).toBe(1)
    // Second use of the same code is refused (maxUses: 1).
    await expect(reservationService.create({ offerId: offer.id, quantity: 1, fulfillment: 'pickup', promoCode: result.promoCode }, customerActor)).rejects.toBeTruthy()
  })

  it('free_bag redemption makes the reservation fully free and still pays the partner full commission', async () => {
    const { user: customer, actor: customerActor } = await makeCustomer()
    const { business, actor: partnerActor } = await makePartner()
    const offer = await makeOffer(business, { priceMinor: 30000 })
    const redemption = await unlockedRedemption(customer.id as string, 'free_bag_10')

    const reservation = await reservationService.create({ offerId: offer.id, quantity: 1, fulfillment: 'pickup', rewardRedemptionId: redemption.id as string }, customerActor)
    expect(reservation.discountMinor).toBe(30000)
    expect(reservation.totalMinor).toBe(0)

    const updatedRedemption = await RewardRedemption.findById(redemption._id).lean()
    expect(updatedRedemption?.status).toBe('redeemed')
    expect(updatedRedemption?.reservation?.toString()).toBe(reservation.id)

    await reservationService.collectByCode({ code: reservation.code.slice(-4), via: 'qr' }, partnerActor)
    const statement = await statementService.partnerStatement(partnerActor, currentMonth(business.timezone))
    // The partner is paid/commissioned as if the customer paid in full — Foodnesi absorbs the discount.
    expect(statement.grossMinor).toBe(30000)
  })

  it('rejects an already-redeemed reward (voucher) on a second attempt', async () => {
    const { actor: customerActor, user: customer } = await makeCustomer()
    const redemption = await unlockedRedemption(customer.id as string, 'vip_voucher_30')
    await rewardService.redeem(redemption.id as string, customerActor)
    await expect(rewardService.redeem(redemption.id as string, customerActor)).rejects.toMatchObject({ code: 'REWARD_NOT_AVAILABLE' })
  })

  it('rejects reusing an already-redeemed free_bag redemption on a new reservation', async () => {
    const { user: customer, actor: customerActor } = await makeCustomer()
    const { business } = await makePartner()
    const offer = await makeOffer(business)
    const redemption = await unlockedRedemption(customer.id as string, 'free_bag_10')
    await reservationService.create({ offerId: offer.id, quantity: 1, fulfillment: 'pickup', rewardRedemptionId: redemption.id as string }, customerActor)
    await expect(
      reservationService.create({ offerId: offer.id, quantity: 1, fulfillment: 'pickup', rewardRedemptionId: redemption.id as string }, customerActor),
    ).rejects.toMatchObject({ code: 'REWARD_NOT_AVAILABLE' })
  })

  it('a concurrent double-spend of the same free_bag redemption only succeeds once', async () => {
    const { user: customer, actor: customerActor } = await makeCustomer()
    const { business } = await makePartner()
    const offer = await makeOffer(business, { quantityTotal: 10 })
    const redemption = await unlockedRedemption(customer.id as string, 'free_bag_10')

    const attempts = await Promise.allSettled([
      reservationService.create({ offerId: offer.id, quantity: 1, fulfillment: 'pickup', rewardRedemptionId: redemption.id as string }, customerActor),
      reservationService.create({ offerId: offer.id, quantity: 1, fulfillment: 'pickup', rewardRedemptionId: redemption.id as string }, customerActor),
    ])
    const succeeded = attempts.filter((a) => a.status === 'fulfilled')
    expect(succeeded).toHaveLength(1)
    expect(await RewardRedemption.countDocuments({ _id: redemption._id, status: 'redeemed' })).toBe(1)
  })
})
