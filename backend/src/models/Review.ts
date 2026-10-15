import { Schema, model, type HydratedDocument, type Types } from 'mongoose'

export interface IReview {
  user: Types.ObjectId
  business: Types.ObjectId
  /** Reviews are tied to a collected reservation — one review per pickup. */
  reservation: Types.ObjectId
  rating: number
  comment?: string
  createdAt: Date
  updatedAt: Date
}

const reviewSchema = new Schema<IReview>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    business: { type: Schema.Types.ObjectId, ref: 'Business', required: true },
    reservation: { type: Schema.Types.ObjectId, ref: 'Reservation', required: true, unique: true },
    rating: { type: Number, required: true, min: 1, max: 5, validate: Number.isInteger },
    comment: { type: String, trim: true, maxlength: 1000 },
  },
  { timestamps: true },
)

reviewSchema.index({ business: 1, createdAt: -1 })

export type ReviewDoc = HydratedDocument<IReview>
export const Review = model<IReview>('Review', reviewSchema)
