import { Schema, model, type Types } from 'mongoose'

/** Partner API key (POS/ERP integrations). Only a SHA-256 hash is stored. */
export interface IApiKey {
  owner: Types.ObjectId
  name: string
  prefix: string
  hash: string
  lastUsedAt?: Date
  revokedAt?: Date
  createdAt: Date
  updatedAt: Date
}

const apiKeySchema = new Schema<IApiKey>(
  {
    owner: { type: Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    name: { type: String, required: true, trim: true, maxlength: 80 },
    prefix: { type: String, required: true },
    hash: { type: String, required: true, unique: true },
    lastUsedAt: Date,
    revokedAt: Date,
  },
  { timestamps: true },
)

export const ApiKey = model<IApiKey>('ApiKey', apiKeySchema)
