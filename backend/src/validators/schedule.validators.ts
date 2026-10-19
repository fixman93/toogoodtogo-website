import { z } from 'zod'
import { ALLERGENS } from '../models/common.js'
import { category, objectId } from './common.js'

const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, 'Vreme u formatu HH:mm.')

const fields = {
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(2000),
  category: category.optional(),
  imageUrl: z.union([z.url(), z.literal('')]).optional(),
  tags: z.array(z.string().trim().max(30)).max(10).optional(),
  contentType: z.enum(['surprise', 'known']).optional(),
  contents: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  allergens: z.array(z.enum(ALLERGENS)).max(ALLERGENS.length).optional(),
  priceMinor: z.number().int().positive(),
  originalPriceMinor: z.number().int().positive(),
  /** `null` removes the price drop. */
  priceDrop: z.object({ time: hhmm, priceMinor: z.number().int().positive() }).nullable().optional(),
  quantity: z.number().int().min(1).max(500),
  maxPerReservation: z.number().int().min(1).max(20).optional(),
  startTime: hhmm,
  endTime: hhmm,
  weekdays: z
    .array(z.number().int().min(1).max(7))
    .min(1, 'Izaberi bar jedan dan.')
    .max(7)
    .transform((v) => [...new Set(v)].sort()),
}

export const createScheduleBody = z.object({ businessId: objectId, ...fields })
export const updateScheduleBody = z
  .object({ ...fields, isActive: z.boolean() })
  .partial()
  .refine((o) => Object.keys(o).length > 0, 'Nothing to update')

export type ScheduleInput = z.infer<typeof createScheduleBody>
