import { Schema, model, type Types } from 'mongoose'

/** Who changed what in administration (role changes, blocks, approvals, moderation). */
export interface IAuditLog {
  actor: Types.ObjectId
  action: string
  targetType: 'user' | 'business' | 'offer' | 'review' | 'application'
  targetId: Types.ObjectId
  summary: string
  details?: Record<string, unknown>
  createdAt: Date
}

const auditSchema = new Schema<IAuditLog>(
  {
    actor: { type: Schema.Types.ObjectId, ref: 'User', required: true },
    action: { type: String, required: true },
    targetType: { type: String, required: true },
    targetId: { type: Schema.Types.ObjectId, required: true },
    summary: { type: String, required: true, maxlength: 300 },
    details: Schema.Types.Mixed,
  },
  { timestamps: { createdAt: true, updatedAt: false } },
)

auditSchema.index({ createdAt: -1 })

export const AuditLog = model<IAuditLog>('AuditLog', auditSchema)
