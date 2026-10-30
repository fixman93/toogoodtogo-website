import { z } from 'zod'
import { pagination } from './common.js'
import { objectId } from './common.js'

export const createReviewBody = z.object({
  reservationId: objectId,
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
  /** Photos of what was in the bag (uploaded first with kind=review). */
  photos: z.array(z.url()).max(3, 'Najviše 3 fotografije.').optional(),
})

export const reviewListQuery = z.object({ ...pagination })

export const reportReviewBody = z.object({ reason: z.string().trim().max(500).optional() })
