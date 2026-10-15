import { Schema, model, type HydratedDocument, type Types } from 'mongoose'

export const FAVORITE_TARGETS = ['business', 'offer'] as const
export type FavoriteTarget = (typeof FAVORITE_TARGETS)[number]

export interface IFavorite {
  user: Types.ObjectId
  targetType: FavoriteTarget
  targetId: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const favoriteSchema = new Schema<IFavorite>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    targetType: { type: String, enum: FAVORITE_TARGETS, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
  },
  { timestamps: true },
)

favoriteSchema.index({ user: 1, targetType: 1, targetId: 1 }, { unique: true })

export type FavoriteDoc = HydratedDocument<IFavorite>
export const Favorite = model<IFavorite>('Favorite', favoriteSchema)
