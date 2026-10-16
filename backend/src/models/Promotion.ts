import { Schema, model, type Types } from 'mongoose'

/**
 * Promo code. Platform codes (no owner) are funded by the platform and settled
 * in the monthly statement; partner codes (owner set) are funded by the partner
 * and apply to their locations (or one location when `business` is set).
 */
export interface IPromotion {
  code: string
  description?: string
  discountType: 'percent' | 'fixed'
  /** Percent (1–90) or fixed amount in minor units. */
  value: number
  /** Currency of a fixed discount; the code only applies to offers in this currency. */
  currency?: string
  owner?: Types.ObjectId
  business?: Types.ObjectId
  validFrom?: Date
  validTo?: Date
  /** null = unlimited */
  maxUses?: number | null
  usesCount: number
  perUserLimit: number
  isActive: boolean
  createdBy: Types.ObjectId
  createdAt: Date
  updatedAt: Date
}

const promotionSchema = new Schema<IPromotion>(
  {
    code: { type: String, required: true, unique: true, uppercase: true, trim: true, maxlength: 30 },
    description: { type: String, maxlength: 200 },
    discountType: { type: String, enum: ['percent', 'fixed'], required: true },
    value: { type: Number, required: true, min: 1 },
    currency: { type: String, uppercase: true, minlength: 3, maxlength: 3 },
    owner: { type: Schema.Types.ObjectId, ref: 'User', index: true },
    business: { type: Schema.Types.ObjectId, ref: 'Business' },
    validFrom: Date,
    validTo: Date,
    maxUses: { type: Number, default: null },
    usesCount: { type: Number, default: 0, min: 0 },
    perUserLimit: { type: Number, default: 1, min: 1 },
    isActive: { type: Boolean, default: true },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
)

export const Promotion = model<IPromotion>('Promotion', promotionSchema)
