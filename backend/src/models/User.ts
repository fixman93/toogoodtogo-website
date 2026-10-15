import { Schema, model, type HydratedDocument } from 'mongoose'

export const ROLES = ['customer', 'business', 'admin'] as const
export type Role = (typeof ROLES)[number]

export interface IUser {
  name: string
  email: string
  passwordHash: string
  role: Role
  locale: string
  countryCode: string
  phone?: string
  createdAt: Date
  updatedAt: Date
}

const userSchema = new Schema<IUser>(
  {
    name: { type: String, required: true, trim: true, minlength: 2, maxlength: 80 },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true, maxlength: 254 },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLES, default: 'customer', index: true },
    locale: { type: String, default: 'sr-Latn-RS' },
    countryCode: { type: String, default: 'RS', uppercase: true, minlength: 2, maxlength: 2 },
    phone: { type: String, trim: true },
  },
  { timestamps: true },
)

export type UserDoc = HydratedDocument<IUser>
export const User = model<IUser>('User', userSchema)
