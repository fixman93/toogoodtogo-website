import { Types } from 'mongoose'
import { Business, Reservation, Review, User } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { serializeReview } from '../utils/serializers.js'
import { isOwnedUrl } from './storage.service.js'
import { runAtomically } from '../utils/transaction.js'
import type { Actor } from './access.service.js'
import { audit } from './audit.service.js'
import { notify } from './notification.service.js'

export async function list(businessId: string, page: number, limit: number) {
  if (!(await Business.exists({ _id: businessId }))) throw ApiError.notFound('Lokal nije pronađen.')
  const [items, total] = await Promise.all([
    Review.find({ business: businessId, isHidden: { $ne: true } })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit)
      .populate<{ user: { _id: Types.ObjectId; name: string } | null }>('user', 'name')
      .lean(),
    Review.countDocuments({ business: businessId, isHidden: { $ne: true } }),
  ])
  return {
    items: items.map((r) => serializeReview(r, r.user)),
    meta: { page, limit, total },
  }
}

/** Only customers who actually collected a bag may review — one review per reservation. */
export async function create(businessId: string, input: { reservationId: string; rating: number; comment?: string; photos?: string[] }, actor: Actor) {
  // Only photos uploaded to our own storage (no hot-linking of other sites).
  const photos = [...new Set(input.photos ?? [])]
  if (photos.some((url) => !isOwnedUrl(url))) throw ApiError.badRequest('Fotografija nije ispravna. Otpremi je ponovo.', 'INVALID_PHOTO')
  const reservation = await Reservation.findOne({ _id: input.reservationId, user: actor.id, business: businessId })
  if (!reservation) throw ApiError.notFound('Rezervacija nije pronađena.')
  if (reservation.status !== 'collected') throw ApiError.conflict('Ocenu možete ostaviti tek nakon preuzimanja.', 'NOT_COLLECTED')
  if (await Review.exists({ reservation: reservation._id })) throw ApiError.conflict('Već ste ocenili ovo preuzimanje.', 'ALREADY_REVIEWED')

  const review = await runAtomically(async (session, onRollback) => {
    const [created] = await Review.create(
      [{ user: actor.id, business: businessId, reservation: reservation._id, rating: input.rating, comment: input.comment, photos }],
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

/** A signed-in user flags a review as inappropriate; one report per user, notifies the platform team. */
export async function report(reviewId: string, actor: Actor, reason?: string) {
  const review = await Review.findById(reviewId)
  if (!review || review.isHidden) throw ApiError.notFound('Ocena nije pronađena.')
  if (review.user.toString() === actor.id) throw ApiError.badRequest('Ne možete prijaviti svoju ocenu.', 'OWN_REVIEW')
  if (review.reportedBy.some((id) => id.toString() === actor.id)) return { reported: true }

  review.reportedBy.push(new Types.ObjectId(actor.id))
  await review.save()

  const admins = await User.find({ role: { $in: ['admin', 'operations'] }, deletedAt: null }).select('_id').lean()
  void notify(
    admins.map((a) => a._id),
    { type: 'review_reported', title: 'Prijavljena ocena', body: reason || 'Korisnik je prijavio ocenu kao neprimerenu.', link: '/admin?tab=reviews' },
  )
  void audit(actor, { action: 'review.reported', targetType: 'review', targetId: review._id, summary: `Prijavljena ocena (${review.reportedBy.length}x)`, details: reason ? { reason } : undefined })

  return { reported: true }
}

/** Latest customer photos for a location ("Šta je bilo u kesi"). */
export async function photos(businessId: string, limit = 12) {
  const rows = await Review.find({ business: businessId, isHidden: { $ne: true }, 'photos.0': { $exists: true } })
    .sort({ createdAt: -1 })
    .limit(limit)
    .populate<{ user: { _id: Types.ObjectId; name: string } | null }>('user', 'name')
    .lean()
  return rows.flatMap((r) => r.photos.map((url) => ({ url, reviewId: r._id.toString(), rating: r.rating, user: serializeReview(r, r.user).user.name, createdAt: r.createdAt.toISOString() }))).slice(0, limit)
}
