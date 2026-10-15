import { z } from 'zod'
import { objectId } from './common.js'

export const salesQuery = z.object({
  /** Local calendar day in the market timezone; defaults to today. */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .optional(),
  businessId: objectId.optional(),
})
