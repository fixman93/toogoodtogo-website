import bcrypt from 'bcryptjs'
import { signToken } from '../middleware/auth.js'
import { ensureReferralCode, findReferrer, levelFor } from './loyalty.service.js'
import { deleteIfOwned } from './storage.service.js'
import { sendMail } from './mail.service.js'
import { createHash, randomBytes } from 'node:crypto'
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

export async function register(input: { name: string; email: string; password: string; referralCode?: string; countryCode?: string }) {
  if (await User.exists({ email: input.email })) throw ApiError.conflict('Nalog sa ovom e-poštom već postoji.', 'EMAIL_TAKEN')
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS)
  // Self-registration always creates customers; partner/admin roles are granted by an admin.
  const referrer = await findReferrer(input.referralCode)
  const user = await User.create({ name: input.name, email: input.email, passwordHash, role: 'customer', referredBy: referrer?._id, ...(input.countryCode ? { countryCode: input.countryCode } : {}) })
  void sendMail(
    user.email,
    `Dobro došao/la, ${user.name.split(' ')[0]}!`,
    'Hvala što spašavaš hranu sa nama.\nPronađi kesu iznenađenja u blizini, rezerviši je i preuzmi u lokalu po trećini cene.',
    '/',
    'Pronađi ponude',
  )
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
  const referralCode = await ensureReferralCode(user._id)
  return { ...serializeUser(user), points: user.points ?? 0, level: levelFor(user.points ?? 0), referralCode }
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

export async function updatePreferences(userId: string, prefs: { push?: boolean; email?: boolean }) {
  const set: Record<string, boolean> = {}
  if (prefs.push != null) set['notificationPrefs.push'] = prefs.push
  if (prefs.email != null) set['notificationPrefs.email'] = prefs.email
  const user = await User.findByIdAndUpdate(userId, { $set: set }, { new: true })
  if (!user) throw ApiError.notFound('Nalog nije pronađen.')
  return serializeUser(user)
}

/** Name and profile photo. A replaced/removed photo is deleted from storage. */
export async function updateProfile(userId: string, input: { name?: string; avatarUrl?: string; countryCode?: string }) {
  const user = await User.findById(userId)
  if (!user) throw ApiError.notFound('Nalog nije pronađen.')
  const previous = user.avatarUrl
  if (input.name != null) user.name = input.name
  if (input.avatarUrl !== undefined) user.avatarUrl = input.avatarUrl || undefined
  if (input.countryCode) user.countryCode = input.countryCode
  await user.save()
  if (input.avatarUrl !== undefined && previous && previous !== user.avatarUrl) void deleteIfOwned(previous)
  return me(user.id)
}

const RESET_TTL_MS = 60 * 60_000
const sha256 = (value: string) => createHash('sha256').update(value).digest('hex')

/** Always "ok" — never reveals whether an e-mail has an account. */
export async function forgotPassword(email: string) {
  const user = await User.findOne({ email: email.toLowerCase(), deletedAt: null, isBlocked: { $ne: true } })
  if (!user) return
  const token = randomBytes(32).toString('base64url')
  user.passwordResetHash = sha256(token)
  user.passwordResetExpires = new Date(Date.now() + RESET_TTL_MS)
  await user.save()
  void sendMail(
    user.email,
    'Promena lozinke',
    'Neko je zatražio novu lozinku za tvoj Zalogaj nalog.\nLink važi 60 minuta. Ako nisi ti, slobodno ignoriši ovu poruku.',
    `/reset-password?token=${token}`,
    'Postavi novu lozinku',
  )
}

export async function resetPassword(token: string, password: string) {
  const user = await User.findOne({ passwordResetHash: sha256(token), passwordResetExpires: { $gt: new Date() }, deletedAt: null })
  if (!user) throw ApiError.badRequest('Link je istekao ili je već iskorišćen. Zatraži novi.', 'RESET_INVALID')
  user.passwordHash = await bcrypt.hash(password, BCRYPT_ROUNDS)
  user.passwordChangedAt = new Date()
  user.passwordResetHash = undefined
  user.passwordResetExpires = undefined
  await user.save()
  void sendMail(user.email, 'Lozinka je promenjena', 'Lozinka tvog Zalogaj naloga je upravo promenjena. Ako to nisi bio/la ti, odmah nam se javi.', '/support', 'Kontaktiraj podršku')
  // New session for the user who just reset it.
  return { user: serializeUser(user), token: signToken(user.id, user.role) }
}
