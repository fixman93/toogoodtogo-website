import { Schema, model, type HydratedDocument, type Types } from 'mongoose'

/**
 * customer · business (partner/owner) · staff (works at specific partner locations)
 * admin (super admin) · operations · support · finance (platform team)
 */
export const ROLES = ['customer', 'business', 'staff', 'admin', 'operations', 'support', 'finance'] as const
export type Role = (typeof ROLES)[number]
export const PLATFORM_ROLES: Role[] = ['admin', 'operations', 'support', 'finance']

/** Proof that the user accepted a legal document (never removed; a new version adds a new entry). */
export interface LegalAcceptance {
  document: 'terms' | 'partner_terms'
  /** Version of the document (config/legal.ts). */
  version: string
  acceptedAt: Date
  /** Version of the privacy policy shown next to the terms (informed, not "accepted"). */
  privacyVersion?: string
}

export type MailStatus = 'pending' | 'sending' | 'sent' | 'failed' | 'skipped'

export interface PartnerOnboarding {
  /** "Vaš nalog partnera je aktiviran" — one per promotion to partner. */
  activationMail?: {
    status: MailStatus
    /** When the user became a partner (identifies the role change the e-mail belongs to). */
    roleChangedAt: Date
    attempts: number
    lastAttemptAt?: Date
    sentAt?: Date
    error?: string
  }
  /** Contract + Prilog A/B signed outside the app, recorded by the team (not an e-signature). */
  contract?: { signedAt: Date; recordedAt: Date; recordedBy: Types.ObjectId; note?: string }
}

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
  legalAcceptances: LegalAcceptance[]
  partnerOnboarding?: PartnerOnboarding
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
    legalAcceptances: {
      type: [
        new Schema<LegalAcceptance>(
          {
            document: { type: String, enum: ['terms', 'partner_terms'], required: true },
            version: { type: String, required: true, maxlength: 32 },
            acceptedAt: { type: Date, required: true },
            privacyVersion: { type: String, maxlength: 32 },
          },
          { _id: false },
        ),
      ],
      default: [],
    },
    partnerOnboarding: {
      type: new Schema<PartnerOnboarding>(
        {
          activationMail: {
            type: new Schema(
              {
                status: { type: String, enum: ['pending', 'sending', 'sent', 'failed', 'skipped'], required: true },
                roleChangedAt: { type: Date, required: true },
                attempts: { type: Number, default: 0 },
                lastAttemptAt: Date,
                sentAt: Date,
                error: { type: String, maxlength: 500 },
              },
              { _id: false },
            ),
            default: undefined,
          },
          contract: {
            type: new Schema(
              {
                signedAt: { type: Date, required: true },
                recordedAt: { type: Date, required: true },
                recordedBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
                note: { type: String, maxlength: 500 },
              },
              { _id: false },
            ),
            default: undefined,
          },
        },
        { _id: false },
      ),
      default: undefined,
    },
  },
  { timestamps: true },
)

// One account per phone number (accounts without a number are not indexed).
userSchema.index({ phone: 1 }, { unique: true, partialFilterExpression: { phone: { $type: 'string' } } })

export type UserDoc = HydratedDocument<IUser>
export const User = model<IUser>('User', userSchema)
