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
})

const parsed = schema.safeParse(process.env)

if (!parsed.success) {
  console.error('❌ Invalid environment configuration:')
  for (const issue of parsed.error.issues) console.error(`   • ${issue.path.join('.')}: ${issue.message}`)
  process.exit(1)
}

export const env = parsed.data
export const isProduction = env.NODE_ENV === 'production'
