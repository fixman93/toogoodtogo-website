import { Schema, model, type Types } from 'mongoose'

export const NOTIFICATION_TYPES = [
  'reservation_new',
  'pickup_check',
  'pickup_confirmed_by_customer',
  'pickup_dispute',
  'partner_status',
  'partner_warning',
  'reservation_confirmed',
  'reservation_cancelled',
  'reservation_collected',
  'offer_new',
  'waitlist_available',
  'application_new',
  'staff_added',
  'support_new',
  'support_reply',
  'reward',
  'application_approved',
  'application_rejected',
] as const
export type NotificationType = (typeof NOTIFICATION_TYPES)[number]

/** In-app notification (the bell). Push/e-mail can be added on top later. */
export interface INotification {
  user: Types.ObjectId
  type: NotificationType
  title: string
  body?: string
  /** In-app path to open, e.g. "/reservations/<id>". */
  link?: string
  readAt?: Date
  createdAt: Date
  updatedAt: Date
}

const notificationSchema = new Schema<INotification>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, enum: NOTIFICATION_TYPES, required: true },
    title: { type: String, required: true, maxlength: 200 },
    body: { type: String, maxlength: 500 },
    link: String,
    readAt: Date,
  },
  { timestamps: true },
)

notificationSchema.index({ user: 1, createdAt: -1 })
// Old notifications clean themselves up after 90 days.
notificationSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 3600 })

export const Notification = model<INotification>('Notification', notificationSchema)
