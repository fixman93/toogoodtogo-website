import bcrypt from 'bcryptjs'
import { env } from '../config/env.js'
import { LEGAL_VERSIONS, type LegalDocument } from '../config/legal.js'
import { signToken } from '../middleware/auth.js'
import { isPhoneDuplicate, normalizePhone, phoneTaken } from '../utils/phone.js'
import { ensureReferralCode, findReferrer, levelFor, welcomeDiscountPercent } from './loyalty.service.js'
import { marketFor } from '../config/markets.js'
import { deleteIfOwned } from './storage.service.js'
import { sendMail } from './mail.service.js'
import { createHash, randomBytes } from 'node:crypto'
import {
  ACTIVE_RESERVATION_STATUSES,
  Business,
  Favorite,
  Notification,
  PartnerApplication,
  PushSubscription,
  Reservation,
  Review,
  SupportTicket,
  User,
  WaitlistEntry,
} from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { serializeUser } from '../utils/serializers.js'

const BCRYPT_ROUNDS = 12

const outdatedTerms = () =>
  ApiError.conflict('Uslovi su u međuvremenu ažurirani. Osveži stranicu i pročitaj novu verziju.', 'LEGAL_VERSION_OUTDATED')

export async function register(input: {
  name: string
  email: string
  password: string
  phone: string
  referralCode?: string
  countryCode?: string
  acceptTerms?: boolean
  termsVersion?: string
  privacyVersion?: string
}) {
  // Enforced here too, not only by the checkbox in the app.
  if (input.acceptTerms !== true) throw ApiError.badRequest('Da bi napravio/la nalog, prihvati Uslove korišćenja.', 'TERMS_NOT_ACCEPTED')
  if (input.termsVersion !== LEGAL_VERSIONS.terms || (input.privacyVersion && input.privacyVersion !== LEGAL_VERSIONS.privacy)) throw outdatedTerms()
  if (await User.exists({ email: input.email })) throw ApiError.conflict('Nalog sa ovom e-poštom već postoji.', 'EMAIL_TAKEN')
  const phone = normalizePhone(input.phone, input.countryCode ?? env.DEFAULT_MARKET)
  if (await User.exists({ phone })) throw phoneTaken()
  const passwordHash = await bcrypt.hash(input.password, BCRYPT_ROUNDS)
  // Self-registration always creates customers; partner/admin roles are granted by an admin.
  const referrer = await findReferrer(input.referralCode)
  const user = await User.create({
    name: input.name,
    email: input.email,
    phone,
    passwordHash,
    role: 'customer',
    referredBy: referrer?._id,
    legalAcceptances: [{ document: 'terms', version: LEGAL_VERSIONS.terms, acceptedAt: new Date(), privacyVersion: LEGAL_VERSIONS.privacy }],
    ...(input.countryCode ? { countryCode: input.countryCode } : {}),
  }).catch((error: unknown) => {
    throw isPhoneDuplicate(error) ? phoneTaken() : error
  })
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
  return {
    ...serializeUser(user),
    points: user.points ?? 0,
    level: levelFor(user.points ?? 0),
    referralCode,
    /** Discount on the first bag when invited by a friend (until it's used). */
    welcomeDiscountPercent: await welcomeDiscountPercent(user._id),
    referralDiscountPercent: marketFor(user.countryCode).referralDiscountPercent,
  }
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

  const avatar = user.avatarUrl
  user.set({
    name: 'Obrisan korisnik',
    email: `deleted-${user.id}@deleted.invalid`,
    passwordHash: await bcrypt.hash(randomBytes(32).toString('hex'), 4),
    phone: undefined,
    avatarUrl: undefined,
    referralCode: undefined,
    isBlocked: true,
    deletedAt: new Date(),
  })
  await user.save()
  void deleteIfOwned(avatar)
  await Promise.all([
    Favorite.deleteMany({ user: user._id }),
    WaitlistEntry.deleteMany({ user: user._id }),
    Notification.deleteMany({ user: user._id }),
    PushSubscription.deleteMany({ user: user._id }),
    PartnerApplication.deleteMany({ user: user._id, status: 'pending' }),
    // Share links of the reservations stop working.
    Reservation.updateMany({ user: user._id }, { $unset: { shareToken: 1 } }),
  ])
}

/**
 * "Preuzmi moje podatke": everything stored about the signed-in user, as JSON
 * (right of access and data portability).
 */
export async function exportMyData(userId: string) {
  const user = await User.findById(userId).lean()
  if (!user || user.deletedAt) throw ApiError.notFound('Nalog nije pronađen.')
  const [reservations, reviews, favorites, waitlist, tickets, applications, pushDevices, notifications] = await Promise.all([
    Reservation.find({ user: user._id }).sort({ createdAt: -1 }).lean(),
    Review.find({ user: user._id }).lean(),
    Favorite.find({ user: user._id }).lean(),
    WaitlistEntry.find({ user: user._id }).lean(),
    SupportTicket.find({ user: user._id }).lean(),
    PartnerApplication.find({ user: user._id }).lean(),
    PushSubscription.find({ user: user._id }).select('userAgent createdAt').lean(),
    Notification.find({ user: user._id }).sort({ createdAt: -1 }).limit(500).lean(),
  ])
  const businessNames = new Map(
    (await Business.find({ _id: { $in: [...reservations.map((r) => r.business), ...reviews.map((r) => r.business)] } }).select('name').lean()).map((b) => [b._id.toString(), b.name]),
  )
  const business = (id: unknown) => businessNames.get(String(id)) ?? null
  return {
    exportedAt: new Date().toISOString(),
    account: {
      id: user._id.toString(),
      name: user.name,
      email: user.email,
      phone: user.phone ?? null,
      role: user.role,
      countryCode: user.countryCode,
      avatarUrl: user.avatarUrl ?? null,
      points: user.points ?? 0,
      referralCode: user.referralCode ?? null,
      invitedBy: user.referredBy ? 'yes' : 'no',
      notificationPrefs: user.notificationPrefs,
      createdAt: user.createdAt,
    },
    legalAcceptances: (user.legalAcceptances ?? []).map((a) => ({ document: a.document, version: a.version, acceptedAt: a.acceptedAt, privacyVersion: a.privacyVersion ?? null })),
    reservations: reservations.map((r) => ({
      code: r.code,
      business: business(r.business),
      offer: r.offerTitle,
      quantity: r.quantity,
      total: r.totalMinor / 100,
      currency: r.currency,
      promoCode: r.promoCode ?? null,
      pickupStart: r.pickupStart,
      pickupEnd: r.pickupEnd,
      status: r.status,
      collectedAt: r.collectedAt ?? null,
      pickupConfirmation: r.pickupCheck?.answer ?? null,
      createdAt: r.createdAt,
    })),
    reviews: reviews.map((r) => ({ business: business(r.business), rating: r.rating, comment: r.comment ?? null, createdAt: r.createdAt })),
    favorites: favorites.map((f) => ({ type: f.targetType, id: f.targetId.toString(), createdAt: f.createdAt })),
    waitlist: waitlist.map((w) => ({ offer: String(w.offer), createdAt: w.createdAt })),
    supportTickets: tickets.map((t) => ({ subject: t.subject, status: t.status, messages: t.messages.map((m) => ({ fromTeam: m.fromTeam, body: m.body, at: m.createdAt })), createdAt: t.createdAt })),
    partnerApplications: applications.map((a) => ({ businessName: a.businessName, city: a.city, phone: a.phone, status: a.status, createdAt: a.createdAt })),
    pushDevices: pushDevices.map((d) => ({ device: d.userAgent ?? null, since: d.createdAt })),
    notifications: notifications.map((n) => ({ title: n.title, body: n.body ?? null, at: n.createdAt })),
  }
}

const CURRENT: Record<LegalDocument, string> = { terms: LEGAL_VERSIONS.terms, partner_terms: LEGAL_VERSIONS.partnerTerms }

/**
 * Accept the current version of the terms (when the app asks again) or of the partner rules
 * (partner portal). Earlier acceptances are kept; accepting the same version twice adds nothing.
 */
export async function acceptLegal(userId: string, input: { document: LegalDocument; version: string; privacyVersion?: string }) {
  if (input.version !== CURRENT[input.document]) throw outdatedTerms()
  const user = await User.findById(userId)
  if (!user || user.deletedAt) throw ApiError.notFound('Nalog nije pronađen.')
  if (input.document === 'partner_terms' && user.role !== 'business') {
    throw ApiError.forbidden('Pravila za partnere prihvata vlasnik partnerskog naloga.', 'NOT_A_PARTNER')
  }
  // Atomic: a double click can't add the same version twice.
  const updated = await User.findOneAndUpdate(
    { _id: user._id, legalAcceptances: { $not: { $elemMatch: { document: input.document, version: input.version } } } },
    {
      $push: {
        legalAcceptances: {
          document: input.document,
          version: input.version,
          acceptedAt: new Date(),
          ...(input.document === 'terms' ? { privacyVersion: LEGAL_VERSIONS.privacy } : {}),
        },
      },
    },
    { new: true },
  )
  return serializeUser(updated ?? user)
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
export async function updateProfile(userId: string, input: { name?: string; avatarUrl?: string; countryCode?: string; phone?: string }) {
  const user = await User.findById(userId)
  if (!user) throw ApiError.notFound('Nalog nije pronađen.')
  const previous = user.avatarUrl
  if (input.name != null) user.name = input.name
  if (input.avatarUrl !== undefined) user.avatarUrl = input.avatarUrl || undefined
  if (input.countryCode) user.countryCode = input.countryCode
  if (input.phone !== undefined) {
    const phone = normalizePhone(input.phone, user.countryCode)
    if (phone !== user.phone && (await User.exists({ phone, _id: { $ne: user._id } }))) throw phoneTaken()
    user.phone = phone
  }
  await user.save().catch((error: unknown) => {
    throw isPhoneDuplicate(error) ? phoneTaken() : error
  })
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
    'Neko je zatražio novu lozinku za tvoj Foodnesi nalog.\nLink važi 60 minuta. Ako nisi ti, slobodno ignoriši ovu poruku.',
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
  void sendMail(user.email, 'Lozinka je promenjena', 'Lozinka tvog Foodnesi naloga je upravo promenjena. Ako to nisi bio/la ti, odmah nam se javi.', '/support', 'Kontaktiraj podršku')
  // New session for the user who just reset it.
  return { user: serializeUser(user), token: signToken(user.id, user.role) }
}
