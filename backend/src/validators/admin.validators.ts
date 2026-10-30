import { z } from 'zod'
import { ROLES } from '../models/User.js'
import { pagination } from './common.js'

export const roleBody = z.object({ role: z.enum(ROLES) })

/** Contract + Prilog A/B signed outside the app (recorded, not signed, in the app). */
export const partnerContractBody = z.object({
  signed: z.boolean(),
  signedAt: z.coerce.date().max(new Date(Date.now() + 86_400_000), 'Datum potpisa ne može biti u budućnosti.').optional(),
  note: z.string().trim().max(500).optional(),
})

export const adminUsersQuery = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(ROLES).optional(),
  ...pagination,
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const adminBusinessesQuery = z.object({
  q: z.string().trim().max(100).optional(),
  status: z.enum(['active', 'inactive']).optional(),
  ...pagination,
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export type AdminUsersQuery = z.infer<typeof adminUsersQuery>
export type AdminBusinessesQuery = z.infer<typeof adminBusinessesQuery>

export const blockBody = z.object({ blocked: z.boolean() })

export const adminReservationsQuery = z.object({
  status: z.enum(['pending_payment', 'confirmed', 'collected', 'cancelled', 'expired']).optional(),
  q: z.string().trim().max(50).optional(),
  ...pagination,
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const adminReviewsQuery = z.object({
  hidden: z.enum(['true', 'false']).optional().transform((v) => (v == null ? undefined : v === 'true')),
  /** Only reviews with at least one user report. */
  reported: z.enum(['true']).optional().transform((v) => v === 'true'),
  ...pagination,
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const reviewHiddenBody = z.object({ hidden: z.boolean() })

export const adminApplicationsQuery = z.object({
  status: z.enum(['pending', 'approved', 'rejected']).optional(),
  ...pagination,
  limit: z.coerce.number().int().min(1).max(100).default(50),
})

export const applicationDecisionBody = z.object({
  status: z.enum(['approved', 'rejected']),
  note: z.string().trim().max(500).optional(),
})

export const auditQuery = z.object({ ...pagination, limit: z.coerce.number().int().min(1).max(100).default(50) })

export const monthQuery = z.object({ month: z.string().regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM') })

export const paymentBody = z.object({
  ownerId: z.string().regex(/^[a-f\d]{24}$/i),
  month: z.string().regex(/^\d{4}-\d{2}$/, 'Use YYYY-MM'),
  amountMinor: z.number().int().min(1).max(1_000_000_000),
  direction: z.enum(['to_platform', 'to_partner']).default('to_platform'),
  method: z.enum(['bank', 'cash', 'other']).default('bank'),
  paidAt: z.coerce.date().max(new Date(Date.now() + 86_400_000), 'Datum ne može biti u budućnosti.').optional(),
  note: z.string().trim().max(300).optional(),
})

export const partnerStatusBody = z.object({
  status: z.enum(['active', 'paused', 'blocked']),
  reason: z.string().trim().max(1000).optional(),
})

export const warningBody = z.object({ message: z.string().trim().min(5, 'Napiši bar par reči.').max(1000) })
export const deletePartnerBody = z.object({ reason: z.string().trim().min(3, 'Navedi razlog.').max(1000) })
