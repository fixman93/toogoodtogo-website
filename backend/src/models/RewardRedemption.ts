import { Schema, model, type HydratedDocument, type Types } from 'mongoose'

export const REDEMPTION_STATUSES = ['unlocked', 'redeemed', 'expired', 'void'] as const
export type RedemptionStatus = (typeof REDEMPTION_STATUSES)[number]

/**
 * One unlocked (and later redeemed) instance of a catalog `Reward` for one
 * user. Every status move is a single status-guarded `findOneAndUpdate`,
 * the same atomic-single-use idiom `reservation.service.ts` already uses
 * for pickup collection — this is what makes concurrent redemption safe.
 */
export interface IRewardRedemption {
  user: Types.ObjectId
  reward: Types.ObjectId
  /** Denormalized for cheap admin reporting without a join. */
  rewardKey: string
  status: RedemptionStatus
  unlockedAt: Date
  /** totalVerifiedPickups value at the moment of unlock, for audit + the uniqueness guard below. */
  unlockedAtPickupCount: number
  redeemedAt?: Date
  expiresAt?: Date
  /** discount_percent: the one-off Promotion minted for this redemption. */
  promotion?: Types.ObjectId
  /** free_bag: the reservation it was applied to. */
  reservation?: Types.ObjectId
  /** voucher: admin's note once fulfillment (e.g. the Tara stay) is arranged. */
  fulfillmentNote?: string
  createdAt: Date
  updatedAt: Date
}

const rewardRedemptionSchema = new Schema<IRewardRedemption>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    reward: { type: Schema.Types.ObjectId, ref: 'Reward', required: true },
    rewardKey: { type: String, required: true },
    status: { type: String, enum: REDEMPTION_STATUSES, default: 'unlocked' },
    unlockedAt: { type: Date, required: true, default: () => new Date() },
    unlockedAtPickupCount: { type: Number, required: true },
    redeemedAt: Date,
    expiresAt: Date,
    promotion: { type: Schema.Types.ObjectId, ref: 'Promotion' },
    reservation: { type: Schema.Types.ObjectId, ref: 'Reservation' },
    fulfillmentNote: { type: String, maxlength: 500 },
  },
  { timestamps: true },
)

// A concurrent double-unlock of the same milestone for the same user loses the race here.
rewardRedemptionSchema.index({ user: 1, reward: 1, unlockedAtPickupCount: 1 }, { unique: true })
rewardRedemptionSchema.index({ user: 1, status: 1 })

export type RewardRedemptionDoc = HydratedDocument<IRewardRedemption>
export const RewardRedemption = model<IRewardRedemption>('RewardRedemption', rewardRedemptionSchema)
