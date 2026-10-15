import { Schema, model, type HydratedDocument, type Types } from 'mongoose'
import { ALLERGENS, CATEGORIES, moneyMinor, pointSchema, type Allergen, type Category, type GeoPoint } from './common.js'

export const OFFER_STATUSES = ['active', 'paused', 'archived'] as const
export type OfferStatus = (typeof OFFER_STATUSES)[number]

export interface IOffer {
  business: Types.ObjectId
  title: string
  description: string
  category: Category
  imageUrl?: string
  tags: string[]
  /** 'surprise' = classic surprise bag; 'known' = the partner lists the exact contents. */
  contentType: 'surprise' | 'known'
  contents: string[]
  allergens: Allergen[]
  /** Prices in minor currency units (para, cents) to avoid float rounding. */
  priceMinor: number
  originalPriceMinor: number
  currency: string
  quantityTotal: number
  /** Decremented atomically on reservation; never below zero. */
  quantityAvailable: number
  maxPerReservation: number
  pickupStart: Date
  pickupEnd: Date
  timezone: string
  status: OfferStatus
  reservedCount: number
  // Denormalized from Business for geo queries and search.
  location: GeoPoint
  businessName: string
  city: string
  createdAt: Date
  updatedAt: Date
}

const offerSchema = new Schema<IOffer>(
  {
    business: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    title: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, required: true, maxlength: 2000 },
    category: { type: String, enum: CATEGORIES, required: true },
    imageUrl: String,
    tags: { type: [String], default: [] },
    contentType: { type: String, enum: ['surprise', 'known'], default: 'surprise' },
    contents: { type: [String], default: [] },
    allergens: { type: [String], enum: ALLERGENS, default: [] },
    priceMinor: moneyMinor,
    originalPriceMinor: moneyMinor,
    currency: { type: String, required: true, uppercase: true, minlength: 3, maxlength: 3 },
    quantityTotal: { type: Number, required: true, min: 1, validate: Number.isInteger },
    quantityAvailable: { type: Number, required: true, min: 0, validate: Number.isInteger },
    maxPerReservation: { type: Number, default: 4, min: 1 },
    pickupStart: { type: Date, required: true },
    pickupEnd: { type: Date, required: true },
    timezone: { type: String, required: true },
    status: { type: String, enum: OFFER_STATUSES, default: 'active' },
    reservedCount: { type: Number, default: 0, min: 0 },
    location: { type: pointSchema, required: true },
    businessName: { type: String, required: true },
    city: { type: String, required: true },
  },
  { timestamps: true },
)

offerSchema.index({ location: '2dsphere', status: 1, pickupEnd: 1 })
offerSchema.index({ status: 1, pickupEnd: 1, category: 1 })

offerSchema.pre('validate', function () {
  if (this.pickupEnd <= this.pickupStart) this.invalidate('pickupEnd', 'pickupEnd must be after pickupStart')
  if (this.priceMinor > this.originalPriceMinor) this.invalidate('priceMinor', 'priceMinor cannot exceed originalPriceMinor')
  if (this.quantityAvailable > this.quantityTotal) this.invalidate('quantityAvailable', 'quantityAvailable cannot exceed quantityTotal')
})

export type OfferDoc = HydratedDocument<IOffer>
export const Offer = model<IOffer>('Offer', offerSchema)
