import { MARKET_CODES } from '../config/markets.js'
import { z } from 'zod'
import { category, pagination } from './common.js'

export const businessListQuery = z.object({
  owner: z.literal('me').optional(),
  /** 'new' = newest partners first (Discover). */
  sort: z.enum(['name', 'new']).default('name'),
  city: z.string().trim().optional(),
  category: category.optional(),
  ...pagination,
})

const address = z.object({
  street: z.string().trim().min(2).max(200),
  city: z.string().trim().min(2).max(100),
  postalCode: z.string().trim().max(20).optional(),
  countryCode: z.string().length(2).toUpperCase().pipe(z.enum(MARKET_CODES, { message: 'Zemlja nije podržana.' })),
})

export const createBusinessBody = z.object({
  name: z.string().trim().min(2).max(120),
  category,
  description: z.string().max(2000).optional(),
  // Empty string clears the image (the UI then shows a category placeholder).
  logoUrl: z.union([z.url(), z.literal('')]).optional(),
  coverUrl: z.union([z.url(), z.literal('')]).optional(),
  phone: z.string().max(40).optional(),
  address,
  location: z.object({ lat: z.number().min(-90).max(90), lng: z.number().min(-180).max(180) }),
  /** Ignored: currency and timezone always come from address.countryCode (config/markets). */
  timezone: z.string().optional(),
  currency: z.string().length(3).toUpperCase().optional(),
  collectionInstructions: z.string().max(1000).optional(),
  openingHours: z.string().trim().max(300).optional(),
  /** Own delivery: price (minor units, location currency) and how far it delivers. */
  delivery: z
    .object({
      enabled: z.boolean(),
      feeMinor: z.number().int().min(0).max(10_000_000),
      radiusKm: z.number().min(0.5, 'Najmanje 0,5 km.').max(50, 'Najviše 50 km.'),
      freeFromMinor: z.number().int().min(0).max(100_000_000).nullable().optional(),
    })
    .optional(),
})

export const updateBusinessBody = createBusinessBody.partial().extend({ isActive: z.boolean().optional() })

export type CreateBusinessInput = z.infer<typeof createBusinessBody>
export type UpdateBusinessInput = z.infer<typeof updateBusinessBody>
