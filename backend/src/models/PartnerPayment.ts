import { Schema, model, type Types } from 'mongoose'
import { moneyMinor } from './common.js'

/**
 * A settlement of one monthly statement, recorded by finance. Customers pay in
 * the shop, so usually the partner pays the platform its commission
 * (`to_platform`); when platform-funded discounts exceed the commission the
 * platform pays the partner (`to_partner`). Several partial payments per month
 * are allowed; the statement shows what is still open.
 */
export interface IPartnerPayment {
  owner: Types.ObjectId
  /** Statement month, YYYY-MM. */
  month: string
  amountMinor: number
  direction: 'to_platform' | 'to_partner'
  method: 'bank' | 'cash' | 'other'
  paidAt: Date
  note?: string
  recordedBy: Types.ObjectId
  createdAt: Date
}

const partnerPaymentSchema = new Schema<IPartnerPayment>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    month: { type: String, required: true, match: /^\d{4}-\d{2}$/ },
    amountMinor: { ...moneyMinor, min: 1 },
    direction: { type: String, enum: ['to_platform', 'to_partner'], default: 'to_platform' },
    method: { type: String, enum: ['bank', 'cash', 'other'], default: 'bank' },
    paidAt: { type: Date, required: true },
    note: { type: String, trim: true, maxlength: 300 },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

partnerPaymentSchema.index({ owner: 1, month: 1 })
partnerPaymentSchema.index({ month: 1 })

export const PartnerPayment = model<IPartnerPayment>('PartnerPayment', partnerPaymentSchema)
