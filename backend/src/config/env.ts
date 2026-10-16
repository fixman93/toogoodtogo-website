import 'dotenv/config'
import { z } from 'zod'

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().positive().default(4000),
  MONGODB_URI: z
    .string({ error: 'MONGODB_URI is required (see backend/.env.example)' })
    .min(1, 'MONGODB_URI is required (see backend/.env.example)'),
  MONGODB_TRANSACTIONS: z.enum(['auto', 'on', 'off']).default('auto'),
  JWT_SECRET: z
    .string({ error: 'JWT_SECRET is required (see backend/.env.example)' })
    .min(32, 'JWT_SECRET must be at least 32 characters'),
  JWT_EXPIRES_IN: z.string().default('7d'),
  CORS_ORIGINS: z
    .string()
    .default('http://localhost:5173')
    .transform((value) => value.split(',').map((o) => o.trim()).filter(Boolean)),
  DEFAULT_MARKET: z.string().default('RS'),
  /** Max login/register attempts per IP per 15 minutes. */
  AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(20),
  /** Public web app URL — used for links in e-mails and push notifications. */
  APP_URL: z.string().url().default('http://localhost:5173'),
  /** Web push (optional). Generate with: npx web-push generate-vapid-keys */
  VAPID_PUBLIC_KEY: z.string().optional(),
  VAPID_PRIVATE_KEY: z.string().optional(),
  VAPID_SUBJECT: z.string().default('mailto:podrska@zalogaj.rs'),
  /** E-mail via MailerSend (optional). Without it e-mails are only logged. */
  MAILERSEND_API_KEY: z.string().optional(),
  /** Sender — its domain must be verified in MailerSend. */
  MAIL_FROM: z.string().default('Zalogaj <noreply@fixman-app.online>'),
  /** Cloudflare R2 (S3-compatible) for uploaded images — optional. */
  R2_ACCOUNT_ID: z.string().optional(),
  R2_ACCESS_KEY_ID: z.string().optional(),
  R2_SECRET_ACCESS_KEY: z.string().optional(),
  R2_BUCKET: z.string().optional(),
  /** Public base URL of the bucket (r2.dev or custom domain). */
  R2_PUBLIC_URL: z.string().url().optional(),
  /** Folder inside the bucket — keeps this app's files separate in a shared bucket. */
  R2_PREFIX: z.string().default('toogoodtogo'),
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:')
  for (const issue of parsed.error.issues) console.error(`   • ${issue.path.join('.')}: ${issue.message}`)
  process.exit(1)
}

export const env = parsed.data
export const isProduction = env.NODE_ENV === 'production'
