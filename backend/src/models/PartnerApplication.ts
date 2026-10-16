import { Schema, model, type Types } from 'mongoose'
import { CATEGORIES, type Category } from './common.js'

export const APPLICATION_STATUSES = ['pending', 'approved', 'rejected'] as const
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number]

/** "Postani partner" request; an admin approves it, which grants the business role. */
export interface IPartnerApplication {
  user: Types.ObjectId
  businessName: string
  contactName: string
  phone: string
  city: string
  countryCode?: string
  category: Category
  locationsCount: number
  message?: string
  status: ApplicationStatus
  reviewedBy?: Types.ObjectId
  reviewedAt?: Date
  reviewNote?: string
  createdAt: Date
  updatedAt: Date
}

const applicationSchema = new Schema<IPartnerApplication>(
  {
    user: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    businessName: { type: String, required: true, trim: true, maxlength: 120 },
    contactName: { type: String, required: true, trim: true, maxlength: 80 },
    phone: { type: String, required: true, trim: true, maxlength: 40 },
    city: { type: String, required: true, trim: true, maxlength: 80 },
    countryCode: { type: String, uppercase: true, minlength: 2, maxlength: 2 },
    category: { type: String, enum: CATEGORIES, required: true },
    locationsCount: { type: Number, default: 1, min: 1, max: 500 },
    message: { type: String, maxlength: 1000 },
    status: { type: String, enum: APPLICATION_STATUSES, default: 'pending', index: true },
    reviewedBy: { type: Schema.Types.ObjectId, ref: 'User' },
    reviewedAt: Date,
    reviewNote: { type: String, maxlength: 500 },
  },
  { timestamps: true },
)

export const PartnerApplication = model<IPartnerApplication>('PartnerApplication', applicationSchema)
