import { afterAll, afterEach, beforeAll, describe, expect, it } from 'vitest'
import { resetTestDb, startTestDb, stopTestDb } from '../test/db.js'
import { makeCustomer, makeOffer, makePartner } from '../test/fixtures.js'
import { LoyaltyTransaction, Reservation, User } from '../models/index.js'
import * as reservationService from './reservation.service.js'

describe('reservation.service — pickup rewards', () => {
  beforeAll(startTestDb, 60_000)
  afterEach(resetTestDb)
  afterAll(stopTestDb)

  it('awards points + pickup count and writes one ledger row on a scan', async () => {
    const { user: customer, actor: customerActor } = await makeCustomer()
    const { business, actor: partnerActor } = await makePartner()
    const offer = await makeOffer(business)

    const reservation = await reservationService.create({ offerId: offer.id, quantity: 1, fulfillment: 'pickup' }, customerActor)
    // collectByCodeBody's zod transform (controller layer) strips the "FN-" prefix before this
    // service call ever sees the code — replicate that here since we're calling the service directly.
    await reservationService.collectByCode({ code: reservation.code.slice(-4), via: 'qr' }, partnerActor)

    const updated = await User.findById(customer.id).select('points totalVerifiedPickups').lean()
    expect(updated?.points).toBe(10)
    expect(updated?.totalVerifiedPickups).toBe(1)

    const ledger = await LoyaltyTransaction.find({ user: customer._id, kind: 'pickup' }).lean()
    expect(ledger).toHaveLength(1)
    expect(ledger[0].points).toBe(10)
  })

  it('rejects a duplicate scan and does not double-award points', async () => {
    const { user: customer, actor: customerActor } = await makeCustomer()
    const { business, actor: partnerActor } = await makePartner()
    const offer = await makeOffer(business)
    const reservation = await reservationService.create({ offerId: offer.id, quantity: 1, fulfillment: 'pickup' }, customerActor)

    // collectByCodeBody's zod transform (controller layer) strips the "FN-" prefix before this
    // service call ever sees the code — replicate that here since we're calling the service directly.
    await reservationService.collectByCode({ code: reservation.code.slice(-4), via: 'qr' }, partnerActor)
    await expect(reservationService.collectByCode({ code: reservation.code.slice(-4), via: 'qr' }, partnerActor)).rejects.toMatchObject({ code: 'ALREADY_COLLECTED' })

    const updated = await User.findById(customer.id).select('points totalVerifiedPickups').lean()
    expect(updated?.points).toBe(10)
    expect(updated?.totalVerifiedPickups).toBe(1)
    expect(await LoyaltyTransaction.countDocuments({ user: customer._id, kind: 'pickup' })).toBe(1)
  })

  it('reverses points + pickup count (clamped at 0) when a dispute is upheld, without a second pickup ledger row', async () => {
    const { user: customer, actor: customerActor } = await makeCustomer()
    const { business, actor: partnerActor } = await makePartner()
    const offer = await makeOffer(business)
    const reservation = await reservationService.create({ offerId: offer.id, quantity: 1, fulfillment: 'pickup' }, customerActor)

    // Simulate an unclaimed pickup the customer self-confirms (collectedVia: 'customer').
    await Reservation.updateOne({ _id: reservation.id }, { $set: { status: 'expired', pickupEnd: new Date(Date.now() - 60_000) } })
    await reservationService.answerPickupCheck(reservation.id, 'collected', customerActor)

    let user = await User.findById(customer.id).select('points totalVerifiedPickups').lean()
    expect(user?.points).toBe(10)
    expect(user?.totalVerifiedPickups).toBe(1)

    await reservationService.openDispute(reservation.id, 'Kupac nije bio u lokalu.', partnerActor)
    await reservationService.resolveDispute(reservation.id, 'upheld', undefined, { id: customer.id as string, role: 'admin' })

    user = await User.findById(customer.id).select('points totalVerifiedPickups').lean()
    expect(user?.points).toBe(0)
    expect(user?.totalVerifiedPickups).toBe(0)
    expect(await LoyaltyTransaction.countDocuments({ user: customer._id, kind: 'dispute_reversal' })).toBe(1)
    // The original pickup row is untouched (not deleted) — pure audit trail.
    expect(await LoyaltyTransaction.countDocuments({ user: customer._id, kind: 'pickup' })).toBe(1)
  })
})
