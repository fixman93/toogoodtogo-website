import { Schema, model, type Types } from 'mongoose'

export const WEBHOOK_EVENTS = ['reservation.created', 'reservation.cancelled', 'reservation.collected'] as const
export type WebhookEvent = (typeof WEBHOOK_EVENTS)[number]

/** Partner webhook: we POST signed JSON for reservation events at their locations. */
export interface IWebhook {
  owner: Types.ObjectId
  url: string
  secret: string
  events: WebhookEvent[]
  isActive: boolean
  lastStatus?: number
  lastError?: string
  lastDeliveredAt?: Date
  createdAt: Date
  updatedAt: Date
}

const webhookSchema = new Schema<IWebhook>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    url: { type: String, required: true, maxlength: 500 },
    secret: { type: String, required: true, select: false },
    events: { type: [String], enum: WEBHOOK_EVENTS, default: [...WEBHOOK_EVENTS] },
    isActive: { type: Boolean, default: true },
    lastStatus: Number,
    lastError: String,
    lastDeliveredAt: Date,
  },
  { timestamps: true },
)

export const Webhook = model<IWebhook>('Webhook', webhookSchema)
