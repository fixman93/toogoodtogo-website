import { z } from 'zod'

export const registerBody = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8).max(128),
  referralCode: z.string().trim().max(12).optional(),
})

export const loginBody = z.object({
  email: z.email().trim().toLowerCase(),
  password: z.string().min(1),
})


export const deleteAccountBody = z.object({ password: z.string().min(1) })

export const preferencesBody = z.object({ push: z.boolean().optional(), email: z.boolean().optional() })
