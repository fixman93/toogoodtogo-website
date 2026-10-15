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
