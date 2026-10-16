import { Schema, model, type Types } from 'mongoose'

export const TICKET_CATEGORIES = ['order', 'partner', 'account', 'other'] as const
export type TicketCategory = (typeof TICKET_CATEGORIES)[number]
export const TICKET_STATUSES = ['open', 'answered', 'closed'] as const
export type TicketStatus = (typeof TICKET_STATUSES)[number]

export interface ITicketMessage {
  author: Types.ObjectId
  fromTeam: boolean
  body: string
  createdAt: Date
}

/** Help request from a customer or partner, answered by the support team. */
export interface ISupportTicket {
  user: Types.ObjectId
  subject: string
  category: TicketCategory
  reservation?: Types.ObjectId
  /** open = waiting for the team · answered = waiting for the user · closed */
  status: TicketStatus
  messages: ITicketMessage[]
  lastMessageAt: Date
  createdAt: Date
  updatedAt: Date
}

const messageSchema = new Schema<ITicketMessage>(
  {
    author: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    fromTeam: { type: Boolean, default: false },
    body: { type: String, required: true, maxlength: 3000 },
    createdAt: { type: Date, default: () => new Date() },
  },
  { _id: false },
)

const ticketSchema = new Schema<ISupportTicket>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    subject: { type: String, required: true, trim: true, maxlength: 150 },
    category: { type: String, enum: TICKET_CATEGORIES, default: 'other' },
    reservation: { type: Schema.Types.ObjectId, ref: 'Reservation' },
    status: { type: String, enum: TICKET_STATUSES, default: 'open', index: true },
    messages: { type: [messageSchema], default: [] },
    lastMessageAt: { type: Date, default: () => new Date() },
  },
  { timestamps: true },
)

ticketSchema.index({ status: 1, lastMessageAt: -1 })

export const SupportTicket = model<ISupportTicket>('SupportTicket', ticketSchema)
