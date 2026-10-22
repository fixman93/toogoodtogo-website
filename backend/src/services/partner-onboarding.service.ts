/**
 * Partner onboarding: the "nalog partnera je aktiviran" e-mail (once per promotion,
 * with its delivery status), the contract signed outside the app (recorded by the
 * team — not an e-signature) and the check before a partner can publish offers.
 */
import type { Types } from 'mongoose'
import { env } from '../config/env.js'
import { PARTNER_CONTRACT_REQUIRED_FOR_OFFERS, PARTNER_TERMS_PATH, PARTNER_TERMS_REQUIRED_FOR_OFFERS } from '../config/legal.js'
import { User, type PartnerOnboarding } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { legalStatus } from '../utils/legal.js'
import type { Actor } from './access.service.js'
import { audit } from './audit.service.js'
import { sendMail } from './mail.service.js'

/** A send that crashed half-way may be retried after this long. */
const STALE_SENDING_MS = 10 * 60_000

const SUBJECT = 'Foodnesi — vaš nalog partnera je aktiviran'

function activationBody() {
  const contact = env.MAIL_REPLY_TO
    ? 'Ako imate pitanja, odgovorite na ovaj e-mail ili kontaktirajte Foodnesi tim.'
    : 'Ako imate pitanja, kontaktirajte Foodnesi tim kroz „Pomoć i podrška" u aplikaciji.'
  return [
    'Poštovani,',
    'Vaš Foodnesi nalog je ažuriran i sada imate pristup funkcijama za partnere.',
    'Pre nego što počnete da objavljujete ponude, molimo vas da pročitate pravila i uslove za poslovne partnere (dugme ispod) i da ih prihvatite u portalu za partnere.',
    'Za početak korišćenja platforme potrebno je da sa Foodnesi timom završite postupak registracije partnera i prihvatite ili potpišete odgovarajući ugovor i komercijalne uslove, ukoliko to već nije završeno.',
    'Podsećamo da partner prodaje hranu i naplaćuje je direktno kupcu. Provizija Foodnesi platforme obračunava se prema ugovorenim uslovima.',
    contact,
    'Srdačan pozdrav,\nFoodnesi tim',
  ].join('\n')
}

/**
 * Called right after a role change to partner was saved: marks a new activation e-mail
 * for this promotion. The caller's update must only match when the role really changed.
 */
export const activationMailMarker = () => ({ status: 'pending' as const, roleChangedAt: new Date(), attempts: 0 })

/**
 * Send the activation e-mail if it hasn't been sent for the current promotion. Safe to call
 * repeatedly: an atomic claim makes sure only one call sends; a failed send can be retried.
 * Never throws for e-mail problems — the result is stored on the user.
 */
export async function sendActivationMail(userId: string | Types.ObjectId) {
  const now = new Date()
  const user = await User.findOneAndUpdate(
    {
      _id: userId,
      role: 'business',
      deletedAt: null,
      'partnerOnboarding.activationMail': { $exists: true },
      $or: [
        { 'partnerOnboarding.activationMail.status': { $in: ['pending', 'failed', 'skipped'] } },
        { 'partnerOnboarding.activationMail.status': 'sending', 'partnerOnboarding.activationMail.lastAttemptAt': { $lt: new Date(now.getTime() - STALE_SENDING_MS) } },
      ],
    },
    {
      $set: { 'partnerOnboarding.activationMail.status': 'sending', 'partnerOnboarding.activationMail.lastAttemptAt': now },
      $inc: { 'partnerOnboarding.activationMail.attempts': 1 },
    },
    { new: true },
  )
  if (!user) return null // already sent, being sent, or no longer a partner
  const result = await sendMail(user.email, SUBJECT, activationBody(), PARTNER_TERMS_PATH, 'Pročitajte pravila za partnere')
  await User.updateOne(
    { _id: user._id, 'partnerOnboarding.activationMail.status': 'sending' },
    {
      $set: {
        'partnerOnboarding.activationMail.status': result.status,
        ...(result.status === 'sent' ? { 'partnerOnboarding.activationMail.sentAt': new Date() } : {}),
        ...(result.error ? { 'partnerOnboarding.activationMail.error': result.error } : {}),
      },
      ...(result.error ? {} : { $unset: { 'partnerOnboarding.activationMail.error': 1 } }),
    },
  )
  if (result.status === 'failed') console.error(`Partner activation e-mail failed for user ${user.id}: ${result.error}`)
  return result.status
}

/** Admin: send the activation e-mail again after a failure (never re-sends one that went out). */
export async function retryActivationMail(userId: string, actor: Actor) {
  const user = await User.findById(userId).select('role email partnerOnboarding')
  if (!user) throw ApiError.notFound('Korisnik nije pronađen.')
  if (user.role !== 'business') throw ApiError.conflict('Korisnik nije partner.', 'NOT_A_PARTNER')
  const mail = user.partnerOnboarding?.activationMail
  if (mail?.status === 'sent') throw ApiError.conflict('E-mail o aktivaciji je već poslat.', 'ALREADY_SENT')
  // Partners promoted before this e-mail existed have no entry yet.
  if (!mail) await User.updateOne({ _id: user._id, 'partnerOnboarding.activationMail': { $exists: false } }, { $set: { 'partnerOnboarding.activationMail': activationMailMarker() } })
  const status = await sendActivationMail(user._id)
  void audit(actor, { action: 'partner.activation_mail', targetType: 'user', targetId: user._id, summary: `E-mail o aktivaciji partnera (${user.email}): ${status ?? 'već u slanju'}` })
  return onboardingSummary((await User.findById(user._id))!)
}

/** Admin: record (or clear) that the contract + Prilog A/B were signed outside the app. */
export async function setContract(userId: string, input: { signed: boolean; signedAt?: Date; note?: string }, actor: Actor) {
  const user = await User.findById(userId)
  if (!user || user.deletedAt) throw ApiError.notFound('Korisnik nije pronađen.')
  if (user.role !== 'business') throw ApiError.conflict('Korisnik nije partner.', 'NOT_A_PARTNER')
  if (input.signed) {
    user.set('partnerOnboarding.contract', { signedAt: input.signedAt ?? new Date(), recordedAt: new Date(), recordedBy: actor.id, note: input.note })
  } else {
    user.set('partnerOnboarding.contract', undefined)
  }
  await user.save()
  void audit(actor, {
    action: input.signed ? 'partner.contract_recorded' : 'partner.contract_cleared',
    targetType: 'user',
    targetId: user._id,
    summary: `${input.signed ? 'Evidentiran potpisan ugovor' : 'Uklonjena evidencija ugovora'}: ${user.email}`,
    details: input.note ? { note: input.note } : undefined,
  })
  return onboardingSummary(user)
}

/** What the admin list shows for a partner. */
export function onboardingSummary(user: { role: string; partnerOnboarding?: PartnerOnboarding; legalAcceptances?: unknown[] } & Parameters<typeof legalStatus>[0]) {
  const mail = user.partnerOnboarding?.activationMail
  const contract = user.partnerOnboarding?.contract
  const legal = legalStatus(user)
  return {
    partnerTermsAcceptedVersion: legal.partnerTermsAcceptedVersion,
    partnerTermsAcceptedAt: legal.partnerTermsAcceptedAt,
    partnerTermsNeedsAcceptance: legal.partnerTermsNeedsAcceptance,
    activationMail: mail
      ? { status: mail.status, attempts: mail.attempts ?? 0, sentAt: mail.sentAt?.toISOString() ?? null, lastAttemptAt: mail.lastAttemptAt?.toISOString() ?? null, error: mail.error ?? null }
      : null,
    contract: contract ? { signedAt: contract.signedAt.toISOString(), recordedAt: contract.recordedAt.toISOString(), note: contract.note ?? null } : null,
  }
}

/** Before a partner adds a location: the partner rules must be accepted first. */
export async function assertCanAddLocations(ownerId: string | Types.ObjectId) {
  const owner = await User.findById(ownerId).select('role legalAcceptances').lean()
  if (!owner || owner.role !== 'business') return
  if (PARTNER_TERMS_REQUIRED_FOR_OFFERS && legalStatus(owner).partnerTermsNeedsAcceptance) {
    throw ApiError.forbidden('Pre dodavanja lokacije prihvati Pravila za partnere na početnoj strani portala za partnere.', 'PARTNER_TERMS_REQUIRED')
  }
}

/** Before a partner's offer goes live (new offer, re-activation, repeating offers). */
export async function assertCanPublishOffers(ownerId: string | Types.ObjectId) {
  const owner = await User.findById(ownerId).select('role legalAcceptances partnerOnboarding').lean()
  // Locations owned by the platform team are not partner locations.
  if (!owner || owner.role !== 'business') return
  if (PARTNER_TERMS_REQUIRED_FOR_OFFERS && legalStatus(owner).partnerTermsNeedsAcceptance) {
    throw ApiError.forbidden('Pre objave ponuda vlasnik naloga treba da prihvati Pravila za partnere na početnoj strani portala za partnere.', 'PARTNER_TERMS_REQUIRED')
  }
  if (PARTNER_CONTRACT_REQUIRED_FOR_OFFERS && !owner.partnerOnboarding?.contract) {
    throw ApiError.forbidden('Ponude se mogu objaviti kada tim Foodnesi evidentira potpisan ugovor sa partnerom.', 'PARTNER_CONTRACT_REQUIRED')
  }
}
