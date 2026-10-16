import { z } from 'zod'
import { ALLERGENS } from '../models/common.js'
import { category, objectId, pagination } from './common.js'

/** Filters shared by the offer list and the map. */
const offerFilters = {
  q: z.string().trim().max(100).optional(),
  category: category.optional(),
  maxPriceMinor: z.coerce.number().int().positive().optional(),
  /** Currency of maxPriceMinor (prices in other currencies can't be compared). */
  currency: z.string().length(3).toUpperCase().optional(),
  pickupDay: z.enum(['today', 'tomorrow']).optional(),
  timeOfDay: z.enum(['morning', 'afternoon', 'evening']).optional(),
}

export const offerListQuery = z.object({
  ...offerFilters,
  businessId: objectId.optional(),
  lat: z.coerce.number().min(-90).max(90).optional(),
  lng: z.coerce.number().min(-180).max(180).optional(),
  maxDistanceKm: z.coerce.number().positive().max(500).optional(),
  sort: z.enum(['distance', 'price', 'popularity', 'pickup', 'rating']).optional(),
  ...pagination,
})

const offerFields = {
  title: z.string().trim().min(2).max(120),
  description: z.string().trim().min(10).max(2000),
  category: category.optional(),
  imageUrl: z.union([z.url(), z.literal('')]).optional(),
  tags: z.array(z.string().trim().max(30)).max(10).optional(),
  contentType: z.enum(['surprise', 'known']).optional(),
  contents: z.array(z.string().trim().min(1).max(80)).max(20).optional(),
  allergens: z.array(z.enum(ALLERGENS)).max(ALLERGENS.length).optional(),
  /** Dynamic pricing; `null` removes it. */
  priceDrop: z.object({ at: z.coerce.date(), priceMinor: z.number().int().positive() }).nullable().optional(),
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

export const manageOffersQuery = z.object({ ...pagination, limit: z.coerce.number().int().min(1).max(200).default(100) })

/** Map: one entry per location inside the visible bounding box (any zoom level). */
export const offerLocationsQuery = z
  .object({
    ...offerFilters,
    minLat: z.coerce.number().min(-90).max(90),
    maxLat: z.coerce.number().min(-90).max(90),
    minLng: z.coerce.number().min(-180).max(180),
    maxLng: z.coerce.number().min(-180).max(180),
  })
  .refine((q) => q.minLat < q.maxLat && q.minLng < q.maxLng, 'Invalid bounding box')

export type OfferFilters = Pick<OfferListQuery, 'q' | 'category' | 'maxPriceMinor' | 'currency' | 'pickupDay' | 'timeOfDay'>
export type OfferLocationsQuery = z.infer<typeof offerLocationsQuery>
