import { Schema, model, type Types } from 'mongoose'

/** A browser/device that accepted web push for a user (one user can have many). */
export interface IPushSubscription {
  user: Types.ObjectId
  endpoint: string
  keys: { p256dh: string; auth: string }
  userAgent?: string
  createdAt: Date
  updatedAt: Date
}

const pushSubscriptionSchema = new Schema<IPushSubscription>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    endpoint: { type: String, required: true, unique: true },
    keys: { p256dh: { type: String, required: true }, auth: { type: String, required: true } },
    userAgent: String,
  },
  { timestamps: true },
)

export const PushSubscription = model<IPushSubscription>('PushSubscription', pushSubscriptionSchema)
