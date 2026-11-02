import { z } from 'zod'
import { REWARD_TYPES } from '../models/Reward.js'
import { objectId } from './common.js'

export const redemptionIdParams = z.object({ id: objectId })

export const adminRewardUpdateBody = z.object({
  title: z.string().trim().min(2).max(120).optional(),
  description: z.string().trim().max(500).optional(),
  thresholdPickups: z.number().int().min(1).optional(),
  value: z.number().min(0).optional(),
  voucherDescription: z.string().trim().max(300).optional(),
  repeatable: z.boolean().optional(),
  isActive: z.boolean().optional(),
})

export const adminRewardCreateBody = adminRewardUpdateBody.extend({
  key: z.string().trim().min(2).max(60),
  title: z.string().trim().min(2).max(120),
  type: z.enum(REWARD_TYPES),
  thresholdPickups: z.number().int().min(1),
  value: z.number().min(0),
})

export const loyaltyConfigBody = z.object({
  enabled: z.boolean().optional(),
  pointsPerBag: z.number().min(0).optional(),
})

export const adminRedemptionsQuery = z.object({
  status: z.enum(['unlocked', 'redeemed', 'expired', 'void']).optional(),
  needsFulfillment: z.enum(['true']).optional().transform((v) => v === 'true'),
})

export type AdminRewardUpdateInput = z.infer<typeof adminRewardUpdateBody>
export type AdminRewardCreateInput = z.infer<typeof adminRewardCreateBody>
export type LoyaltyConfigInput = z.infer<typeof loyaltyConfigBody>
export type AdminRedemptionsQuery = z.infer<typeof adminRedemptionsQuery>
