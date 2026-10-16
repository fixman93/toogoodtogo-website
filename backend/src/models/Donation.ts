import { Schema, model, type Types } from 'mongoose'

/** Unsold food given to a charity/food bank — recorded for traceability and impact. */
export interface IDonation {
  business: Types.ObjectId
  recordedBy: Types.ObjectId
  date: Date
  organization: string
  bags: number
  weightKg?: number
  items?: string
  pickedUpBy?: string
  note?: string
  createdAt: Date
  updatedAt: Date
}

const donationSchema = new Schema<IDonation>(
  {
    business: { type: Schema.Types.ObjectId, ref: 'Business', required: true, index: true },
    recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    date: { type: Date, required: true },
    organization: { type: String, required: true, trim: true, maxlength: 120 },
    bags: { type: Number, default: 0, min: 0 },
    weightKg: { type: Number, min: 0 },
    items: { type: String, maxlength: 500 },
    pickedUpBy: { type: String, maxlength: 120 },
    note: { type: String, maxlength: 500 },
  },
  { timestamps: true },
)

donationSchema.index({ date: -1 })

export const Donation = model<IDonation>('Donation', donationSchema)
