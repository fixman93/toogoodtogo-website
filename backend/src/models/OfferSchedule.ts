import { Schema, model, type HydratedDocument, type Types } from 'mongoose'
import { ALLERGENS, CATEGORIES, moneyMinor, type Allergen, type Category } from './common.js'

/**
 * A repeating offer ("Kesa od 18h, Pon–Sub"). The partner sets it up once; a
 * job publishes a normal Offer for today and tomorrow on the chosen weekdays.
 * Each published offer can still be edited (e.g. the number of bags that day).
 */
export interface IOfferSchedule {
  business: Types.ObjectId
  createdBy: Types.ObjectId
  title: string
  description: string
  category: Category
  imageUrl?: string
  tags: string[]
  contentType: 'surprise' | 'known'
  contents: string[]
  allergens: Allergen[]
  priceMinor: number
  originalPriceMinor: number
  /** Optional automatic price drop at this local time ("HH:mm"). */
  priceDrop?: { time: string; priceMinor: number }
  quantity: number
  maxPerReservation?: number
  /** Local pickup window, "HH:mm" (same day; end after start). */
  startTime: string
  endTime: string
  /** ISO weekdays: 1 = Monday … 7 = Sunday. */
  weekdays: number[]
  isActive: boolean
  /** Latest local date ("YYYY-MM-DD") an offer was published for. */
  lastDate?: string
  createdAt: Date
  updatedAt: Date
}

const time = { type: String, required: true, match: /^([01]\d|2[0-3]):[0-5]\d$/ }

const scheduleSchema = new Schema<IOfferSchedule>(
  {
    business: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
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
    priceDrop: { type: new Schema({ time, priceMinor: moneyMinor }, { _id: false }), default: undefined },
    quantity: { type: Number, required: true, min: 1, max: 500, validate: Number.isInteger },
    maxPerReservation: { type: Number, min: 1, max: 20 },
    startTime: time,
    endTime: time,
    weekdays: { type: [Number], required: true, validate: (v: number[]) => v.length > 0 && v.every((d) => Number.isInteger(d) && d >= 1 && d <= 7) },
    isActive: { type: Boolean, default: true, index: true },
    lastDate: String,
  },
  { timestamps: true },
)

export type OfferScheduleDoc = HydratedDocument<IOfferSchedule>
export const OfferSchedule = model<IOfferSchedule>('OfferSchedule', scheduleSchema)
