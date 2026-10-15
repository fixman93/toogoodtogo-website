/**
 * Waitlist for sold-out offers ("Obavesti me"). When bags become available
 * again (a cancellation or the partner adding stock), everyone waiting is
 * notified once and removed from the list — first come, first served.
 */
import type { Types } from 'mongoose'
import { Offer, WaitlistEntry } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import type { Actor } from './access.service.js'
import { notify } from './notification.service.js'

export async function myOfferIds(actor: Actor) {
  const entries = await WaitlistEntry.find({ user: actor.id }).select('offer').lean()
  return entries.map((e) => e.offer.toString())
}

export async function join(offerId: string, actor: Actor) {
  const offer = await Offer.findById(offerId)
  if (!offer || offer.status === 'archived' || offer.pickupEnd <= new Date()) throw ApiError.notFound('Ponuda nije pronađena.')
  if (offer.status === 'active' && offer.quantityAvailable > 0) throw ApiError.conflict('Ponuda je već dostupna – rezerviši je.', 'OFFER_AVAILABLE')
  await WaitlistEntry.updateOne({ user: actor.id, offer: offer._id }, { $setOnInsert: { user: actor.id, offer: offer._id } }, { upsert: true })
}

export async function leave(offerId: string, actor: Actor) {
  await WaitlistEntry.deleteOne({ user: actor.id, offer: offerId })
}

/** Call after anything that may have made bags available again. */
export async function notifyIfAvailable(offerId: Types.ObjectId | string) {
  try {
    const offer = await Offer.findById(offerId)
    if (!offer || offer.status !== 'active' || offer.quantityAvailable <= 0 || offer.pickupEnd <= new Date()) return
    const waiting = await WaitlistEntry.find({ offer: offer._id }).select('user').lean()
    if (!waiting.length) return
    await notify(
      waiting.map((w) => w.user),
      {
        type: 'waitlist_available',
        title: `Ponovo dostupno: ${offer.businessName}`,
        body: `${offer.title} – požuri, kese idu brzo.`,
        link: `/offers/${offer.id}`,
      },
    )
    await WaitlistEntry.deleteMany({ offer: offer._id })
  } catch (error) {
    console.error('Waitlist notification failed', error)
  }
}
