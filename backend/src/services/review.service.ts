import type { Types } from 'mongoose'
import { Business, Reservation, Review, User } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { serializeReview } from '../utils/serializers.js'
import { runAtomically } from '../utils/transaction.js'
import type { Actor } from './access.service.js'

export async function list(businessId: string, page: number, limit: number) {
  if (!(await Business.exists({ _id: businessId }))) throw ApiError.notFound('Lokal nije pronađen.')
  const [items, total] = await Promise.all([
    Review.find({ business: businessId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate<{ user: { _id: Types.ObjectId; name: string } | null }>('user', 'name')
      .lean(),
    Review.countDocuments({ business: businessId }),
  ])
  return {
    items: items.map((r) => serializeReview(r, r.user)),
    meta: { page, limit, total },
  }
}

/** Only customers who actually collected a bag may review — one review per reservation. */
export async function create(businessId: string, input: { reservationId: string; rating: number; comment?: string }, actor: Actor) {
  const reservation = await Reservation.findOne({ _id: input.reservationId, user: actor.id, business: businessId })
  if (!reservation) throw ApiError.notFound('Rezervacija nije pronađena.')
  if (reservation.status !== 'collected') throw ApiError.conflict('Ocenu možete ostaviti tek nakon preuzimanja.', 'NOT_COLLECTED')
  if (await Review.exists({ reservation: reservation._id })) throw ApiError.conflict('Već ste ocenili ovo preuzimanje.', 'ALREADY_REVIEWED')

  const review = await runAtomically(async (session, onRollback) => {
    const [created] = await Review.create(
      [{ user: actor.id, business: businessId, reservation: reservation._id, rating: input.rating, comment: input.comment }],
      { session },
    )
    onRollback(() => Review.deleteOne({ _id: created._id }))
    // Incremental average in a single atomic pipeline update.
    await Business.updateOne(
      { _id: businessId },
      [
        {
          $set: {
            'rating.average': {
              $divide: [{ $add: [{ $multiply: ['$rating.average', '$rating.count'] }, input.rating] }, { $add: ['$rating.count', 1] }],
            },
            'rating.count': { $add: ['$rating.count', 1] },
          },
        },
      ],
      { session },
    )
    return created
  })

  const user = await User.findById(actor.id).select('name').lean()
  return serializeReview(review, user)
}
