import { Schema, model, type HydratedDocument, type Types } from 'mongoose'
import { CATEGORIES, pointSchema, type Category, type GeoPoint } from './common.js'

export interface IBusiness {
  owner: Types.ObjectId
  name: string
  slug: string
  category: Category
  description?: string
  logoUrl?: string
  coverUrl?: string
  phone?: string
  address: { street: string; city: string; postalCode?: string; countryCode: string }
  location: GeoPoint
  timezone: string
  currency: string
  collectionInstructions?: string
  /** Free text, e.g. "Pon–Pet 7–21, Sub 8–15, Ned zatvoreno". */
  openingHours?: string
  rating: { average: number; count: number }
  isActive: boolean
  /** Hidden by the platform because the partner is paused/blocked (independent of isActive). */
  suspended?: boolean
  /** Commission override for this location (0–0.5); market default when unset. */
  commissionRate?: number
  /** Set when a location with history (reservations/reviews) is deleted; hidden everywhere. */
  deletedAt?: Date
  createdAt: Date
  updatedAt: Date
}

/**
 * One document per physical pickup location. A chain with several stores
 * registers several businesses under the same owner account.
 */
const businessSchema = new Schema<IBusiness>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 120 },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    category: { type: String, enum: CATEGORIES, required: true, index: true },
    description: { type: String, maxlength: 2000 },
    logoUrl: String,
    coverUrl: String,
    phone: String,
    address: {
      street: { type: String, required: true },
      city: { type: String, required: true, index: true },
      postalCode: String,
      countryCode: { type: String, required: true, uppercase: true, minlength: 2, maxlength: 2 },
    },
    location: { type: pointSchema, required: true },
    timezone: { type: String, required: true },
    currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
    collectionInstructions: { type: String, maxlength: 1000 },
    openingHours: { type: String, maxlength: 300 },
    rating: {
      average: { type: Number, default: 0, min: 0, max: 5 },
      count: { type: Number, default: 0, min: 0 },
    },
    isActive: { type: Boolean, default: true },
    commissionRate: { type: Number, min: 0, max: 0.5 },
    suspended: { type: Boolean, default: false },
    deletedAt: { type: Date, index: true },
  },
  { timestamps: true },
)

businessSchema.index({ location: '2dsphere' })

export type BusinessDoc = HydratedDocument<IBusiness>
export const Business = model<IBusiness>('Business', businessSchema)
