import { MARKET_CODES } from '../config/markets.js'
import { z } from 'zod'
import { category, objectId } from './common.js'

export const salesQuery = z.object({
  /** Local calendar day in the market timezone; defaults to today. */
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .optional(),
  businessId: objectId.optional(),
})

export const ordersQuery = z.object({
  date: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use YYYY-MM-DD')
    .optional(),
  status: z.enum(['active', 'collected', 'cancelled', 'expired']).optional(),
  businessId: objectId.optional(),
})

export const applicationBody = z.object({
  businessName: z.string().trim().min(2).max(120),
  contactName: z.string().trim().min(2).max(80),
  phone: z.string().trim().min(6).max(40),
  city: z.string().trim().min(2).max(80),
  countryCode: z.string().length(2).toUpperCase().pipe(z.enum(MARKET_CODES)).optional(),
  category,
  locationsCount: z.coerce.number().int().min(1).max(500).default(1),
  message: z.string().trim().max(1000).optional(),
})
