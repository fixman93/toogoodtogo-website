import { Schema, model, type Types } from 'mongoose'

/**
 * Singleton, admin-editable knobs for the rewards program. Reward
 * thresholds/values live on individual `Reward` docs — this only holds the
 * one global rate and the program-wide kill switch.
 */
export interface ILoyaltyConfig {
  _id: 'default'
  enabled: boolean
  pointsPerBag: number
  updatedAt: Date
  updatedBy?: Types.ObjectId
}

const loyaltyConfigSchema = new Schema<ILoyaltyConfig>(
  {
    _id: { type: String, default: 'default' },
    enabled: { type: Boolean, default: true },
    pointsPerBag: { type: Number, required: true, min: 0, default: 10 },
    updatedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: false, updatedAt: true } },
)

export const LoyaltyConfig = model<ILoyaltyConfig>('LoyaltyConfig', loyaltyConfigSchema)
