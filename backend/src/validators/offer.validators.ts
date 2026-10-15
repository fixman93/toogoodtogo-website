import { z } from 'zod'
import { category, objectId, pagination } from './common.js'

export const offerListQuery = z.object({
  q: z.string().trim().max(100).optional(),
  category: category.optional(),
  businessId: objectId.optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  maxDistanceKm: z.coerce.number().positive().max(500).optional(),
  maxPriceMinor: z.coerce.number().int().positive().optional(),
  pickupDay: z.enum(['today', 'tomorrow']).optional(),
  timeOfDay: z.enum(['morning', 'afternoon', 'evening']).optional(),
  sort: z.enum(['distance', 'price', 'popularity', 'pickup']).optional(),
  ...pagination,
})

const offerFields = {
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(2000),
  category: category.optional(),
  imageUrl: z.url().optional(),
  tags: z.array(z.string().trim().max(30)).max(10).optional(),
  priceMinor: z.number().int().positive(),
  originalPriceMinor: z.number().int().positive(),
  quantityTotal: z.number().int().min(1).max(500),
  maxPerReservation: z.number().int().min(1).max(20).optional(),
  pickupStart: z.coerce.date(),
  pickupEnd: z.coerce.date(),
}

const checkOffer = <T extends z.ZodType<Partial<{ priceMinor: number; originalPriceMinor: number; pickupStart: Date; pickupEnd: Date }>>>(schema: T) =>
  schema
    .refine((o) => !o.priceMinor || !o.originalPriceMinor || o.priceMinor < o.originalPriceMinor, {
      message: 'priceMinor must be lower than originalPriceMinor',
      path: ['priceMinor'],
    })
    .refine((o) => !o.pickupStart || !o.pickupEnd || o.pickupEnd > o.pickupStart, {
      message: 'pickupEnd must be after pickupStart',
      path: ['pickupEnd'],
    })

export const createOfferBody = checkOffer(z.object({ businessId: objectId, ...offerFields }))

export const updateOfferBody = checkOffer(
  z
    .object({ ...offerFields, status: z.enum(['active', 'paused']) })
    .partial()
    .refine((o) => Object.keys(o).length > 0, 'Nothing to update'),
)

export type OfferListQuery = z.infer<typeof offerListQuery>
export type CreateOfferInput = z.infer<typeof createOfferBody>
export type UpdateOfferInput = z.infer<typeof updateOfferBody>
