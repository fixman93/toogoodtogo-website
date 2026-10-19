import { z } from 'zod'
import { objectId, pagination } from './common.js'

export const createReservationBody = z.object({
  offerId: objectId,
  quantity: z.number().int().min(1).max(20).default(1),
  promoCode: z.string().trim().min(2).max(30).optional(),
  fulfillment: z.enum(['pickup', 'delivery']).default('pickup'),
  /** Required for delivery: where to bring it. */
  delivery: z
    .object({
      address: z.string().trim().min(3, 'Upiši adresu za dostavu.').max(300),
      lat: z.number().min(-90).max(90),
      lng: z.number().min(-180).max(180),
      note: z.string().trim().max(300).optional(),
    })
    .optional(),
})

/** Courier's phone position while delivering. */
export const courierLocationBody = z.object({
  lat: z.number().min(-90).max(90),
  lng: z.number().min(-180).max(180),
  heading: z.number().min(0).max(360).nullable().optional(),
})

export const reservationListQuery = z.object({
  scope: z.enum(['upcoming', 'history', 'all']).default('all'),
  /** Business owners/admins: list reservations for one of their businesses. */
  businessId: objectId.optional(),
  ...pagination,
})

export type ReservationListQuery = z.infer<typeof reservationListQuery>
export type CreateReservationInput = z.infer<typeof createReservationBody>

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
  /** How the code reached the counter: scanned QR or typed (recorded for pickup statistics). */
  via: z.enum(['qr', 'code']).optional(),
})

export const pickupCheckBody = z.object({ answer: z.enum(['collected', 'not_collected']) })
export const disputeBody = z.object({ reason: z.string().trim().min(5, 'Opiši ukratko šta se desilo.').max(500) })
