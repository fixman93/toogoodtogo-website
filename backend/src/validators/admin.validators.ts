import { z } from 'zod'
import { pagination } from './common.js'

export const roleBody = z.object({ role: z.enum(['customer', 'business', 'admin']) })

export const adminUsersQuery = z.object({
  q: z.string().trim().max(100).optional(),
  role: z.enum(['customer', 'business', 'admin']).optional(),
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
