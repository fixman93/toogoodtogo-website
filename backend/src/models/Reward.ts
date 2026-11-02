import { Schema, model } from 'mongoose'

/**
 * The Foodnesi Rewards catalog. Seeded once (see seed/data.ts) and then
 * fully admin-editable — thresholds/values are never hardcoded in the frontend.
 */
export const REWARD_TYPES = ['bonus_points', 'discount_percent', 'free_bag', 'voucher'] as const
export type RewardType = (typeof REWARD_TYPES)[number]

export interface IReward {
  /** Stable identifier used in code (seed data, tests) — never shown to users. */
  key: string
  title: string
  description?: string
  type: RewardType
  /** totalVerifiedPickups needed to unlock. */
  thresholdPickups: number
  /** Percent for discount_percent, bag count for free_bag, points for bonus_points; unused for voucher. */
  value: number
  /** Free-text value for a physical/manually-fulfilled reward (voucher type). */
  voucherDescription?: string
  /** bonus_points only: re-fires every time totalVerifiedPickups crosses a multiple of thresholdPickups. */
  repeatable: boolean
  isActive: boolean
  createdAt: Date
  updatedAt: Date
}

const rewardSchema = new Schema<IReward>(
  {
    key: { type: String, required: true, unique: true, trim: true, maxlength: 60 },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, maxlength: 500 },
    type: { type: String, enum: REWARD_TYPES, required: true },
    thresholdPickups: { type: Number, required: true, min: 1, validate: Number.isInteger },
    value: { type: Number, required: true, min: 0 },
    voucherDescription: { type: String, maxlength: 300 },
    repeatable: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
)

rewardSchema.index({ isActive: 1, thresholdPickups: 1 })

export const Reward = model<IReward>('Reward', rewardSchema)
