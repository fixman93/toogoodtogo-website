import { Schema, model, type Types } from 'mongoose'

/**
 * Moderation history of a partner, shown to the partner on their portal and
 * profile. `warning` stays visible until the team resolves it; the other kinds
 * are written automatically when the partner's status changes.
 */
export const PARTNER_NOTE_KINDS = ['warning', 'paused', 'blocked', 'reactivated', 'deleted'] as const
export type PartnerNoteKind = (typeof PARTNER_NOTE_KINDS)[number]

export interface IPartnerNote {
  owner: Types.ObjectId
  kind: PartnerNoteKind
  message: string
  createdBy: Types.ObjectId
  resolvedAt?: Date
  resolvedBy?: Types.ObjectId
  createdAt: Date
}

const partnerNoteSchema = new Schema<IPartnerNote>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    kind: { type: String, enum: PARTNER_NOTE_KINDS, required: true },
    message: { type: String, required: true, trim: true, maxlength: 1000 },
    createdBy: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    resolvedAt: Date,
    resolvedBy: { type: Schema.Types.ObjectId, ref: 'User' },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

export const PartnerNote = model<IPartnerNote>('PartnerNote', partnerNoteSchema)
