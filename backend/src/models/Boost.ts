import { Schema, model, type HydratedDocument, type Types } from 'mongoose'

export const BOOST_KINDS = ['top', 'push'] as const
export type BoostKind = (typeof BOOST_KINDS)[number]

/**
 * A paid promotion of one offer. Customers pay in the shop, so the price is
 * added to the partner's monthly statement (month of `createdAt`, local time).
 */
export interface IBoost {
  business: Types.ObjectId
  owner: Types.ObjectId
  offer: Types.ObjectId
  kind: BoostKind
  priceMinor: number
  currency: string
  timezone: string
  /** `top`: listed first until then (the offer's pickup end). */
  until?: Date
  /** `push`: how many people were notified. */
  recipients?: number
  createdBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const boostSchema = new Schema<IBoost>(
  {
    business: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    offer: { type: Schema.Types.ObjectId, ref: 'Offer', required: true },
    kind: { type: String, enum: BOOST_KINDS, required: true },
    priceMinor: { type: Number, required: true, min: 0 },
    currency: { type: String, required: true },
    timezone: { type: String, required: true },
    until: Date,
    recipients: Number,
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)

// One promotion of each kind per offer.
boostSchema.index({ offer: 1, kind: 1 }, { unique: true })
boostSchema.index({ business: 1, createdAt: 1 })

export type BoostDoc = HydratedDocument<IBoost>
export const Boost = model<IBoost>('Boost', boostSchema)
