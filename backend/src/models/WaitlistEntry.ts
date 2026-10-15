import { Schema, model, type Types } from 'mongoose'

/** "Notify me when available" for a sold-out offer. Removed once notified. */
export interface IWaitlistEntry {
  user: Types.ObjectId
  offer: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const waitlistSchema = new Schema<IWaitlistEntry>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    offer: { type: Schema.Types.ObjectId, ref: 'Offer', required: true, index: true },
  },
  { timestamps: true },
)

waitlistSchema.index({ user: 1, offer: 1 }, { unique: true })

export const WaitlistEntry = model<IWaitlistEntry>('WaitlistEntry', waitlistSchema)
