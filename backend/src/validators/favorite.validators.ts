import { z } from 'zod'
import { objectId } from './common.js'

export const createFavoriteBody = z.object({
  targetType: z.enum(['business', 'offer']),
  targetId: objectId,
})
