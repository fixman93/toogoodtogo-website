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


export const forgotPasswordBody = z.object({ email: z.email().trim().toLowerCase() })
export const resetPasswordBody = z.object({ token: z.string().min(20).max(200), password: z.string().min(8).max(128) })

export const deleteAccountBody = z.object({ password: z.string().min(1) })

export const profileBody = z.object({
  name: z.string().trim().min(2).max(80).optional(),
  avatarUrl: z.union([z.url(), z.literal('')]).optional(),
})

export const preferencesBody = z.object({ push: z.boolean().optional(), email: z.boolean().optional() })
