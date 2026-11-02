import { Schema, model, type Types } from 'mongoose'

/**
 * Audit trail for every point award/spend/adjustment. `User.points` stays the
 * fast, authoritative running balance (unchanged by this model) — this is
 * purely for traceability (support, disputes, anti-fraud review).
 */
export const LOYALTY_TXN_KINDS = ['pickup', 'challenge', 'streak', 'referral', 'bonus_milestone', 'dispute_reversal', 'redemption', 'admin_adjustment'] as const
export type LoyaltyTxnKind = (typeof LOYALTY_TXN_KINDS)[number]

export interface ILoyaltyTransaction {
  user: Types.ObjectId
  kind: LoyaltyTxnKind
  /** Signed delta (negative for a spend/reversal). */
  points: number
  /** Signed delta to totalVerifiedPickups (0 for a pure-points event). */
  pickupDelta: number
  /** The pickup this event is about, when applicable. */
  reservation?: Types.ObjectId
  /** The redemption this spend is about, when applicable. */
  redemption?: Types.ObjectId
  /** User.points right after this event, for a cheap ledger read. */
  balanceAfter: number
  note?: string
  createdAt: Date
}

const loyaltyTransactionSchema = new Schema<ILoyaltyTransaction>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: LOYALTY_TXN_KINDS, required: true },
    points: { type: Number, required: true },
    pickupDelta: { type: Number, default: 0 },
    reservation: { type: Schema.Types.ObjectId, ref: 'Reservation' },
    redemption: { type: Schema.Types.ObjectId, ref: 'RewardRedemption' },
    balanceAfter: { type: Number, required: true, min: 0 },
    note: { type: String, maxlength: 500 },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

loyaltyTransactionSchema.index({ user: 1, createdAt: -1 })
// At most one ledger row of a given kind per reservation (markCollected/answerPickupCheck already
// guarantee a reservation is rewarded at most once; this is the belt-and-suspenders guard at the ledger
// layer). Scoped by kind too, so a later 'dispute_reversal' row for the same reservation isn't blocked
// by its original 'pickup' row.
loyaltyTransactionSchema.index({ reservation: 1, kind: 1 }, { unique: true, sparse: true })
loyaltyTransactionSchema.index({ redemption: 1 }, { sparse: true })

export const LoyaltyTransaction = model<ILoyaltyTransaction>('LoyaltyTransaction', loyaltyTransactionSchema)
