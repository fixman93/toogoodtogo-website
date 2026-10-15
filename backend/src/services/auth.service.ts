import bcrypt from 'bcryptjs'
import { signToken } from '../middleware/auth.js'
import { randomBytes } from 'node:crypto'
import {
  ACTIVE_RESERVATION_STATUSES,
  Business,
  Favorite,
  Notification,
  PartnerApplication,
  Reservation,
  User,
  WaitlistEntry,
} from '../models/index.js'
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
  if (!user || !valid || user.deletedAt) throw ApiError.unauthorized('Pogrešna e-pošta ili lozinka.', 'INVALID_CREDENTIALS')
  if (user.isBlocked) throw ApiError.forbidden('Nalog je blokiran. Kontaktiraj podršku.', 'ACCOUNT_BLOCKED')
  return { user: serializeUser(user), token: signToken(user.id, user.role) }
}

export async function me(userId: string) {
  const user = await User.findById(userId)
  if (!user) throw ApiError.unauthorized('Nalog više ne postoji.', 'USER_NOT_FOUND')
  return serializeUser(user)
}

/**
 * Delete the signed-in account. Personal data is anonymized (not hard-deleted)
 * so partners' sales history stays consistent; the account can't be used again.
 */
export async function deleteAccount(userId: string, password: string) {
  const user = await User.findById(userId).select('+passwordHash')
  if (!user || user.deletedAt) throw ApiError.notFound('Nalog nije pronađen.')
  if (!(await bcrypt.compare(password, user.passwordHash))) throw ApiError.unauthorized('Pogrešna lozinka.', 'INVALID_PASSWORD')
  if (user.role === 'admin' && (await User.countDocuments({ role: 'admin', deletedAt: null })) <= 1) {
    throw ApiError.conflict('Ti si jedini admin – prvo dodeli admin ulogu nekom drugom.', 'LAST_ADMIN')
  }
  if (await Reservation.exists({ user: user._id, status: { $in: ACTIVE_RESERVATION_STATUSES } })) {
    throw ApiError.conflict('Imaš aktivne rezervacije. Preuzmi ih ili otkaži, pa obriši nalog.', 'HAS_ACTIVE_RESERVATIONS')
  }
  if (await Business.exists({ owner: user._id, deletedAt: null })) {
    throw ApiError.conflict('Prvo obriši svoje lokacije u portalu za partnere.', 'HAS_BUSINESSES')
  }

  user.set({
    name: 'Obrisan korisnik',
    email: `deleted-${user.id}@deleted.invalid`,
    passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 4),
    phone: undefined,
    isBlocked: true,
    deletedAt: new Date(),
  })
  await user.save()
  await Promise.all([
    Favorite.deleteMany({ user: user._id }),
    WaitlistEntry.deleteMany({ user: user._id }),
    Notification.deleteMany({ user: user._id }),
    PartnerApplication.deleteMany({ user: user._id, status: 'pending' }),
  ])
}
