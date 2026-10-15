import { Schema } from 'mongoose'

export const CATEGORIES = ['meals', 'bakery', 'groceries', 'sweets'] as const
export type Category = (typeof CATEGORIES)[number]

/** GeoJSON point. Note: coordinates are [longitude, latitude]. */
export interface GeoPoint {
  type: 'Point'
  coordinates: [number, number]
}

export const pointSchema = new Schema<GeoPoint>(
  {
    type: { type: String, enum: ['Point'], default: 'Point', required: true },
    coordinates: {
      type: [Number],
      required: true,
      validate: {
        validator: (c: number[]) => c.length === 2 && Math.abs(c[0]) <= 180 && Math.abs(c[1]) <= 90,
        message: 'coordinates must be [lng, lat]',
      },
    },
  },
  { _id: false },
)

export const moneyMinor = { type: Number, required: true, min: 0, validate: Number.isInteger }
