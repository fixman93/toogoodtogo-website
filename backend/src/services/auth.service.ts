import bcrypt from 'bcryptjs'
import { signToken } from '../middleware/auth.js'
import { User } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { serializeUser } from '../utils/serializers.js'

const BCRYPT_ROUNDS = 12

export async function register(input: { name: string; email: string; password: string }) {
  if (await User.exists({ email: input.email })) throw ApiError.conflict('Nalog sa ovom e-poštom već postoji.', 'EMAIL_TAKEN')
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS)
  // Self-registration always creates customers; partner/admin roles are granted by an admin.
  const user = await User.create({ name: input.name, email: input.email, passwordHash, role: 'customer' })
  return { user: serializeUser(user), token: signToken(user.id, user.role) }
}

export async function login(input: { email: string; password: string }) {
  const user = await User.findOne({ email: input.email }).select('+passwordHash')
  const valid = user && (await bcrypt.compare(input.password, user.passwordHash))
  if (!user || !valid) throw ApiError.unauthorized('Pogrešna e-pošta ili lozinka.', 'INVALID_CREDENTIALS')
  return { user: serializeUser(user), token: signToken(user.id, user.role) }
}

export async function me(userId: string) {
  const user = await User.findById(userId)
  if (!user) throw ApiError.unauthorized('Nalog više ne postoji.', 'USER_NOT_FOUND')
  return serializeUser(user)
}
