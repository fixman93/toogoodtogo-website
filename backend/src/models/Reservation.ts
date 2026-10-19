import { Schema, model, type HydratedDocument, type Types } from 'mongoose'
import { moneyMinor, pointSchema, type GeoPoint } from './common.js'

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

export const COLLECTED_VIA = ['qr', 'code', 'list', 'customer'] as const
export type CollectedVia = (typeof COLLECTED_VIA)[number]

export const FULFILLMENTS = ['pickup', 'delivery'] as const
export type Fulfillment = (typeof FULFILLMENTS)[number]

/**
 * preparing  — ordered for delivery, not on the way yet
 * on_the_way — a courier (partner staff) started it; their phone sends its position
 * delivered  — handed over at the door (the reservation is then `collected`)
 */
export const DELIVERY_STAGES = ['preparing', 'on_the_way', 'delivered'] as const
export type DeliveryStage = (typeof DELIVERY_STAGES)[number]

export interface ReservationDelivery {
  /** Address as the customer typed it, plus the point it was found at. */
  address: string
  location: GeoPoint
  /** Floor, entrance, bell… */
  note?: string
  /** Fee snapshot; paid with the order at the door. Not part of totalMinor (no commission on it). */
  feeMinor: number
  /** Straight-line distance from the location when ordered. */
  distanceMeters: number
  stage: DeliveryStage
  courier?: Types.ObjectId
  courierName?: string
  startedAt?: Date
  deliveredAt?: Date
  /** Latest position sent by the courier's phone; removed once delivered (privacy). */
  courierLocation?: { lat: number; lng: number; heading?: number; at: Date }
  /** Courier tapped "Stigao sam". */
  arrivedAt?: Date
  /** Quick messages between courier and customer ("Silazim", "Kasnim 10 min"…). */
  messages: { from: 'courier' | 'customer'; key: DeliveryMessageKey; at: Date }[]
}

export const COURIER_MESSAGES = ['late_10', 'cant_find', 'calling'] as const
export const CUSTOMER_MESSAGES = ['coming_down', 'wait_5', 'call_me'] as const
export type DeliveryMessageKey = (typeof COURIER_MESSAGES)[number] | (typeof CUSTOMER_MESSAGES)[number]

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
  /** Promo code applied at reservation time (total is already discounted). */
  promotion?: Types.ObjectId
  promoCode?: string
  discountMinor: number
  /** Who pays for the discount — platform discounts are credited in the monthly statement. */
  discountFundedBy?: 'platform' | 'partner'
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
  /** Secret for the "send to a friend" pickup link. */
  shareToken?: string
  collectedAt?: Date
  /** Commission rate in force when the bag was collected, so later rate changes don't rewrite past statements. */
  commissionRate?: number
  /**
   * How the hand-over was recorded: scanned QR, typed code, "Izdaj" in the
   * order list, or confirmed by the customer after the partner didn't record it.
   */
  collectedVia?: CollectedVia
  /**
   * The customer's phone was at the shop during the pickup window (sent only
   * while the reservation is open in the app, and only when close by).
   */
  presence?: { firstAt: Date; lastAt: Date; minDistanceMeters: number; accuracyMeters: number; pings: number }
  /** Integrity warning: the customer was at the shop but the hand-over wasn't recorded. */
  integrityAlert?: { kind: 'arrived_not_scanned' | 'arrived_cancelled'; at: Date }
  /** Picked up in the shop (default) or delivered by the partner's own courier. */
  fulfillment: Fulfillment
  delivery?: ReservationDelivery
  /** "Did you pick it up?" asked to the customer when the reservation expired unclaimed. */
  pickupCheck?: { askedAt?: Date; answer?: 'collected' | 'not_collected'; answeredAt?: Date }
  /** Partner disputes a customer-confirmed pickup; the platform team decides. */
  dispute?: {
    status: 'open' | 'upheld' | 'rejected'
    reason: string
    openedAt: Date
    openedBy: Types.ObjectId
    resolvedAt?: Date
    resolvedBy?: Types.ObjectId
    note?: string
  }
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
    promotion: { type: Schema.Types.ObjectId, ref: 'Promotion' },
    promoCode: String,
    discountMinor: { type: Number, default: 0, min: 0 },
    discountFundedBy: { type: String, enum: ['platform', 'partner'] },
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
    commissionRate: { type: Number, min: 0, max: 0.5 },
    collectedVia: { type: String, enum: COLLECTED_VIA },
    presence: {
      type: new Schema(
        { firstAt: Date, lastAt: Date, minDistanceMeters: Number, accuracyMeters: Number, pings: { type: Number, default: 0 } },
        { _id: false },
      ),
      default: undefined,
    },
    integrityAlert: {
      type: new Schema({ kind: { type: String, enum: ['arrived_not_scanned', 'arrived_cancelled'], required: true }, at: { type: Date, required: true } }, { _id: false }),
      default: undefined,
    },
    fulfillment: { type: String, enum: FULFILLMENTS, default: 'pickup' },
    delivery: {
      type: new Schema<ReservationDelivery>(
        {
          address: { type: String, required: true, maxlength: 300 },
          location: { type: pointSchema, required: true },
          note: { type: String, maxlength: 300 },
          feeMinor: { type: Number, required: true, min: 0 },
          distanceMeters: { type: Number, required: true, min: 0 },
          stage: { type: String, enum: DELIVERY_STAGES, default: 'preparing' },
          courier: { type: Schema.Types.ObjectId, ref: 'User' },
          courierName: String,
          startedAt: Date,
          deliveredAt: Date,
          courierLocation: { lat: Number, lng: Number, heading: Number, at: Date },
          arrivedAt: Date,
          messages: {
            type: [new Schema({ from: { type: String, enum: ['courier', 'customer'], required: true }, key: { type: String, required: true }, at: { type: Date, required: true } }, { _id: false })],
            default: [],
          },
        },
        { _id: false },
      ),
      default: undefined,
    },
    pickupCheck: {
      askedAt: Date,
      answer: { type: String, enum: ['collected', 'not_collected'] },
      answeredAt: Date,
    },
    dispute: {
      type: new Schema(
        {
          status: { type: String, enum: ['open', 'upheld', 'rejected'], required: true },
          reason: { type: String, required: true, maxlength: 500 },
          openedAt: { type: Date, required: true },
          openedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
          resolvedAt: Date,
          resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
          note: { type: String, maxlength: 500 },
        },
        { _id: false },
      ),
      default: undefined,
    },
    shareToken: { type: String, unique: true, sparse: true },
  },
  { timestamps: true },
)

reservationSchema.index({ user: 1, pickupStart: -1 })
reservationSchema.index({ status: 1, pickupEnd: 1 })
reservationSchema.index({ business: 1, pickupEnd: -1 })
reservationSchema.index({ 'dispute.status': 1 }, { sparse: true })
reservationSchema.index({ 'integrityAlert.at': -1 }, { sparse: true })
reservationSchema.index({ business: 1, code: 1 })

export type ReservationDoc = HydratedDocument<IReservation>
export const Reservation = model<IReservation>('Reservation', reservationSchema)
