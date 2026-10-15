import { z } from 'zod'
import { pagination } from './common.js'
import { objectId } from './common.js'

export const createReviewBody = z.object({
  reservationId: objectId,
  rating: z.number().int().min(1).max(5),
  comment: z.string().trim().max(1000).optional(),
})

export const reviewListQuery = z.object({ ...pagination })
