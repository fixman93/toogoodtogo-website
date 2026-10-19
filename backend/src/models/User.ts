import { Schema, model, type HydratedDocument, type Types } from 'mongoose'

/**
 * customer · business (partner/owner) · staff (works at specific partner locations)
 * admin (super admin) · operations · support · finance (platform team)
 */
export const ROLES = ['customer', 'business', 'staff', 'admin', 'operations', 'support', 'finance'] as const
export type Role = (typeof ROLES)[number]
export const PLATFORM_ROLES: Role[] = ['admin', 'operations', 'support', 'finance']

export interface IUser {
  name: string
  email: string
  passwordHash: string
  role: Role
  locale: string
  countryCode: string
  /** E.164 (+381641234567); one account per number (see utils/phone). */
  phone?: string
  /** Password reset (hash of the e-mailed token) and session invalidation. */
  passwordResetHash?: string
  passwordResetExpires?: Date
  passwordChangedAt?: Date
  /** Profile photo (R2 URL). */
  avatarUrl?: string
  /** Blocked by an admin: cannot sign in or use the API. */
  isBlocked: boolean
  /**
   * Partner standing set by the platform team. `paused` hides all of the
   * partner's locations and offers (they can still sign in); `blocked` also
   * blocks sign-in; `deleted` is a removed partner.
   */
  partnerStatus?: 'active' | 'paused' | 'blocked' | 'deleted'
  partnerStatusReason?: string
  partnerStatusAt?: Date
  /** Partner locations a `staff` user works at (scan + orders only). */
  staffOf: Types.ObjectId[]
  notificationPrefs: { push: boolean; email: boolean }
  /** Loyalty points (rescued bags, referrals). */
  points: number
  /** Personal invite code; friends who sign up with it earn both a bonus. */
  referralCode?: string
  referredBy?: Types.ObjectId
  referralRewarded: boolean
  /** Weekly challenge already rewarded for this ISO week ("2026-W42"). */
  challengeWeek?: string
  /** Longest weekly streak already rewarded (every 4 weeks). */
  streakRewarded?: number
  /** Set when the user deleted their account (personal data is anonymized). */
  deletedAt?: Date
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
    avatarUrl: String,
    passwordResetHash: { type: String, select: false, index: true },
    passwordResetExpires: { type: Date, select: false },
    passwordChangedAt: Date,
    isBlocked: { type: Boolean, default: false },
    partnerStatus: { type: String, enum: ['active', 'paused', 'blocked', 'deleted'] },
    partnerStatusReason: { type: String, maxlength: 1000 },
    partnerStatusAt: Date,
    staffOf: { type: [{ type: Schema.Types.ObjectId, ref: 'Business' }], default: [], index: true },
    points: { type: Number, default: 0, min: 0 },
    referralCode: { type: String, unique: true, sparse: true, uppercase: true },
    referredBy: { type: Schema.Types.ObjectId, ref: 'User' },
    referralRewarded: { type: Boolean, default: false },
    challengeWeek: String,
    streakRewarded: { type: Number, default: 0 },
    notificationPrefs: {
      push: { type: Boolean, default: true },
      email: { type: Boolean, default: true },
    },
    deletedAt: Date,
  },
  { timestamps: true },
)

// One account per phone number (accounts without a number are not indexed).
userSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: 'string' } } })

export type UserDoc = HydratedDocument<IUser>
export const User = model<IUser>('User', userSchema)
