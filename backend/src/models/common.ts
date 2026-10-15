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

/** The 14 allergens that must be declared in the EU/Serbia. */
export const ALLERGENS = [
  'gluten',
  'crustaceans',
  'eggs',
  'fish',
  'peanuts',
  'soy',
  'milk',
  'nuts',
  'celery',
  'mustard',
  'sesame',
  'sulphites',
  'lupin',
  'molluscs',
] as const
export type Allergen = (typeof ALLERGENS)[number]

/** Rough CO2e avoided per rescued bag (kg), used for the customer's impact stats. */
export const CO2E_KG_PER_BAG = 2.7

export const moneyMinor = { type: Number, required: true, min: 0, validate: Number.isInteger }
