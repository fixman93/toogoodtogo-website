import { z } from 'zod'
import { MARKET_CODES } from '../config/markets.js'

const countryCode = z.string().length(2).toUpperCase().pipe(z.enum(MARKET_CODES))

export const registerBody = z.object({
  name: z.string().trim().min(2).max(80),
  email: z.email().trim().toLowerCase(),
  password: z.string().min(8).max(128),
  referralCode: z.string().trim().max(12).optional(),
  phone: z.string({ error: 'Unesi broj telefona.' }).trim().min(1, 'Unesi broj telefona.').max(30),
  /** Country chosen in the app (prices, cities); defaults to the platform market. */
  countryCode: countryCode.optional(),
  /** The terms checkbox; checked in the service so the user gets a clear message. */
  acceptTerms: z.boolean().optional(),
  /** Versions of the terms / privacy policy linked next to the checkbox. */
  termsVersion: z.string().trim().max(32).optional(),
  privacyVersion: z.string().trim().max(32).optional(),
})

export const acceptLegalBody = z.object({
  document: z.enum(['terms', 'partner_terms']),
  version: z.string().trim().min(1).max(32),
  /** Only with `terms`: the privacy policy version linked next to it. */
  privacyVersion: z.string().trim().max(32).optional(),
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
  countryCode: countryCode.optional(),
  phone: z.string().trim().min(1, 'Unesi broj telefona.').max(30).optional(),
})

export const preferencesBody = z.object({ push: z.boolean().optional(), email: z.boolean().optional() })
