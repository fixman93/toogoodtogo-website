import { Schema, model, type HydratedDocument, type Types } from 'mongoose'
import { moneyMinor } from './common.js'

/**
 * pending_payment — reserved stock awaiting online payment (future use)
 * confirmed       — ready for pickup
 * collected       — handed over by the business
 * cancelled       — cancelled by customer or business; stock restored
 * expired         — not collected before pickup window ended
 */
export const RESERVATION_STATUSES = ['pending_payment', 'confirmed', 'collected', 'cancelled', 'expired'] as const
export type ReservationStatus = (typeof RESERVATION_STATUSES)[number]
export const ACTIVE_RESERVATION_STATUSES: ReservationStatus[] = ['pending_payment', 'confirmed']

export const PAYMENT_STATUSES = ['not_required', 'pending', 'paid', 'refunded', 'failed'] as const
export type PaymentStatus = (typeof PAYMENT_STATUSES)[number]

export interface IReservation {
  user: Types.ObjectId
  offer: Types.ObjectId
  business: Types.ObjectId
  code: string
  quantity: number
  /** Price snapshot at reservation time — later offer edits don't affect it. */
  unitPriceMinor: number
  originalUnitPriceMinor: number
  totalMinor: number
  currency: string
  offerTitle: string
  offerImageUrl?: string
  pickupStart: Date
  pickupEnd: Date
  timezone: string
  status: ReservationStatus
  payment: {
    status: PaymentStatus
    method: 'pay_at_pickup' | 'online'
    provider?: string
    providerReference?: string
    /** For future online payments: release stock if unpaid by this time. */
    holdExpiresAt?: Date
  }
  cancelledAt?: Date
  cancelledBy?: 'customer' | 'business' | 'system'
  collectedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const reservationSchema = new Schema<IReservation>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    offer: { type: Schema.Types.ObjectId, ref: 'Offer', required: true, index: true },
    business: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    code: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1, validate: Number.isInteger },
    unitPriceMinor: moneyMinor,
    originalUnitPriceMinor: moneyMinor,
    totalMinor: moneyMinor,
    currency: { type: String, required: true },
    offerTitle: { type: String, required: true },
    offerImageUrl: String,
    pickupStart: { type: Date, required: true },
    pickupEnd: { type: Date, required: true },
    timezone: { type: String, required: true },
    status: { type: String, enum: RESERVATION_STATUSES, default: 'confirmed', index: true },
    payment: {
      status: { type: String, enum: PAYMENT_STATUSES, default: 'not_required' },
      method: { type: String, enum: ['pay_at_pickup', 'online'], default: 'pay_at_pickup' },
      provider: String,
      providerReference: String,
      holdExpiresAt: Date,
    },
    cancelledAt: Date,
    cancelledBy: { type: String, enum: ['customer', 'business', 'system'] },
    collectedAt: Date,
  },
  { timestamps: true },
)

reservationSchema.index({ user: 1, pickupStart: -1 })
reservationSchema.index({ status: 1, pickupEnd: 1 })
reservationSchema.index({ business: 1, code: 1 })

export type ReservationDoc = HydratedDocument<IReservation>
export const Reservation = model<IReservation>('Reservation', reservationSchema)
