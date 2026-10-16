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

/** Accepts "FN-4F7K", "fn4f7k", "4F7K" (and old "ZL-4F7K") and normalizes to the 4-character code "4F7K". */
export const collectByCodeBody = z.object({
  code: z
    .string()
    .trim()
    .transform((v) => {
      const plain = v.toUpperCase().replace(/[^A-Z0-9]/g, '')
      return plain.length === 6 && /^(FN|ZL)/.test(plain) ? plain.slice(2) : plain
    })
    .pipe(z.string().length(4, 'Kod ima 4 znaka (npr. FN-4F7K).')),
  reservationId: objectId.optional(),
})
