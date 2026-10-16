import { z } from 'zod'
import { objectId, pagination } from './common.js'

export const createReservationBody = z.object({
  offerId: objectId,
  quantity: z.number().int().min(1).max(20).default(1),
  promoCode: z.string().trim().min(2).max(30).optional(),
})

export const reservationListQuery = z.object({
  scope: z.enum(['upcoming', 'history', 'all']).default('all'),
  /** Business owners/admins: list reservations for one of their businesses. */
  businessId: objectId.optional(),
  ...pagination,
})

export type ReservationListQuery = z.infer<typeof reservationListQuery>

/** Accepts "ZL-4F7K", "zl4f7k" or "4F7K" and normalizes to "ZL-4F7K". */
export const collectByCodeBody = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => v.toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^ZL/, ''))
    .pipe(z.string().length(4, 'Kod ima 4 znaka (npr. ZL-4F7K).'))
    .transform((v) => `ZL-${v}`),
  reservationId: objectId.optional(),
})
