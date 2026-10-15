import { Types } from 'mongoose'
import { z } from 'zod'

export const objectId = z.string().refine((v) => Types.ObjectId.isValid(v), 'Invalid id')
export const idParams = z.object({ id: objectId })

export const pagination = {
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
}

export const category = z.enum(['meals', 'bakery', 'groceries', 'sweets'])
