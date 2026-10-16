/**
 * Platform moderation of partners (owner accounts): warnings, pause, block and
 * removal. Every action is written to the partner's history (PartnerNote),
 * which the partner sees on their portal and profile, and to the audit log.
 *
 * Pausing never touches the partner's own on/off switches: locations get a
 * separate `suspended` flag and active offers are paused with `pausedByAdmin`,
 * so reactivation restores exactly what the partner had running.
 */
import { ACTIVE_RESERVATION_STATUSES, Business, Offer, PartnerNote, Reservation, User, type PartnerNoteKind } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import type { Actor } from './access.service.js'
import { audit } from './audit.service.js'
import { notify } from './notification.service.js'

export type PartnerStatus = 'active' | 'paused' | 'blocked'

async function loadPartner(id: string) {
  const user = await User.findById(id)
  if (!user || user.deletedAt || !(user.role === 'business' || (await Business.exists({ owner: user._id })))) {
    throw ApiError.notFound('Partner nije pronađen.')
  }
  return user
}

async function suspend(ownerId: unknown) {
  const ids = (await Business.find({ owner: ownerId }).select('_id').lean()).map((b) => b._id)
  await Business.updateMany({ _id: { $in: ids } }, { $set: { suspended: true } })
  await Offer.updateMany({ business: { $in: ids }, status: 'active' }, { $set: { status: 'paused', pausedByAdmin: true } })
}

async function restore(ownerId: unknown) {
  const ids = (await Business.find({ owner: ownerId }).select('_id').lean()).map((b) => b._id)
  await Business.updateMany({ _id: { $in: ids } }, { $set: { suspended: false } })
  // Only offers we paused and that can still be picked up; the partner's own pauses stay.
  await Offer.updateMany({ business: { $in: ids }, pausedByAdmin: true, pickupEnd: { $gt: new Date() } }, { $set: { status: 'active' }, $unset: { pausedByAdmin: 1 } })
  await Offer.updateMany({ business: { $in: ids }, pausedByAdmin: true }, { $unset: { pausedByAdmin: 1 } })
}

function serializeNote(n: { _id: unknown; kind: PartnerNoteKind; message: string; createdAt: Date; resolvedAt?: Date }, author?: string) {
  return {
    id: String(n._id),
    kind: n.kind,
    message: n.message,
    createdAt: n.createdAt.toISOString(),
    resolvedAt: n.resolvedAt?.toISOString() ?? null,
    author: author ?? null,
  }
}

const STATUS_COPY: Record<PartnerStatus, { kind: PartnerNoteKind; title: string; audit: string }> = {
  paused: { kind: 'paused', title: 'Tvoj partnerski nalog je pauziran', audit: 'Pauziran partner' },
  blocked: { kind: 'blocked', title: 'Tvoj partnerski nalog je blokiran', audit: 'Blokiran partner' },
  active: { kind: 'reactivated', title: 'Tvoj partnerski nalog je ponovo aktivan', audit: 'Ponovo aktiviran partner' },
}

export async function setStatus(id: string, status: PartnerStatus, reason: string | undefined, actor: Actor) {
  if (id === actor.id) throw ApiError.conflict('Ne možeš menjati status sopstvenog naloga.', 'CANNOT_MODERATE_SELF')
  const user = await loadPartner(id)
  const previous = user.partnerStatus ?? 'active'
  if (previous === status) throw ApiError.conflict('Partner je već u tom statusu.', 'NO_CHANGE')
  if (status !== 'active' && !reason) throw ApiError.badRequest('Navedi razlog – partner će ga videti.', 'REASON_REQUIRED')

  if (status === 'active') await restore(user._id)
  else if (previous === 'active') await suspend(user._id)

  user.set({ partnerStatus: status, partnerStatusReason: status === 'active' ? undefined : reason, partnerStatusAt: new Date(), isBlocked: status === 'blocked' })
  await user.save()

  const copy = STATUS_COPY[status]
  const message = reason || (status === 'active' ? 'Lokacije i ponude su ponovo vidljive kupcima.' : '')
  await PartnerNote.create({ owner: user._id, kind: copy.kind, message, createdBy: actor.id })
  // A blocked partner can't sign in, so the e-mail is what reaches them.
  void notify([user._id], { type: 'partner_status', title: copy.title, body: message, link: '/business' }, { force: true })
  void audit(actor, { action: `partner.${status}`, targetType: 'user', targetId: user._id, summary: `${copy.audit}: ${user.email}${reason ? ` – ${reason}` : ''}` })
  return standing(user.id)
}

export async function warn(id: string, message: string, actor: Actor) {
  const user = await loadPartner(id)
  const note = await PartnerNote.create({ owner: user._id, kind: 'warning', message, createdBy: actor.id })
  void notify([user._id], { type: 'partner_warning', title: 'Upozorenje od tima Zalogaj', body: message, link: '/business' }, { force: true })
  void audit(actor, { action: 'partner.warning', targetType: 'user', targetId: user._id, summary: `Upozorenje za ${user.email}: ${message.slice(0, 200)}` })
  return serializeNote(note)
}

export async function resolveWarning(noteId: string, actor: Actor) {
  const note = await PartnerNote.findOneAndUpdate(
    { _id: noteId, kind: 'warning', resolvedAt: null },
    { $set: { resolvedAt: new Date(), resolvedBy: actor.id } },
    { new: true },
  )
  if (!note) throw ApiError.notFound('Upozorenje nije pronađeno ili je već rešeno.')
  void audit(actor, { action: 'partner.warning_resolved', targetType: 'user', targetId: note.owner, summary: `Rešeno upozorenje: ${note.message.slice(0, 200)}` })
  return serializeNote(note)
}

/**
 * Remove a partner: refused while customers still have bags to collect.
 * Locations are soft-deleted and offers archived so customers' history and
 * the partner's statements and payments stay intact; the account can't sign in.
 */
export async function remove(id: string, reason: string, actor: Actor) {
  if (id === actor.id) throw ApiError.conflict('Ne možeš obrisati sopstveni nalog ovde.', 'CANNOT_MODERATE_SELF')
  const user = await loadPartner(id)
  const ids = (await Business.find({ owner: user._id }).select('_id').lean()).map((b) => b._id)
  if (await Reservation.exists({ business: { $in: ids }, status: { $in: ACTIVE_RESERVATION_STATUSES } })) {
    throw ApiError.conflict('Partner ima aktivne rezervacije. Prvo ga pauziraj, pa ga obriši kada kupci preuzmu ili otkažu.', 'HAS_ACTIVE_RESERVATIONS')
  }
  await Offer.updateMany({ business: { $in: ids } }, { $set: { status: 'archived' }, $unset: { pausedByAdmin: 1 } })
  await Business.updateMany({ _id: { $in: ids }, deletedAt: null }, { $set: { isActive: false, suspended: true, deletedAt: new Date() } })
  user.set({ partnerStatus: 'deleted', partnerStatusReason: reason, partnerStatusAt: new Date(), isBlocked: true, deletedAt: new Date(), role: 'customer', staffOf: [] })
  await user.save()
  await User.updateMany({ staffOf: { $in: ids } }, { $pull: { staffOf: { $in: ids } } })
  await PartnerNote.create({ owner: user._id, kind: 'deleted', message: reason, createdBy: actor.id })
  void audit(actor, { action: 'partner.delete', targetType: 'user', targetId: user._id, summary: `Obrisan partner: ${user.email} – ${reason}` })
}

/** Status, open warnings and full history of one partner. */
export async function standing(ownerId: string) {
  const user = await User.findById(ownerId).select('partnerStatus partnerStatusReason partnerStatusAt').lean()
  const notes = await PartnerNote.find({ owner: ownerId }).sort({ createdAt: -1 }).limit(100).lean()
  const authors = new Map((await User.find({ _id: { $in: notes.map((n) => n.createdBy) } }).select('name').lean()).map((u) => [u._id.toString(), u.name]))
  return {
    status: (user?.partnerStatus ?? 'active') as PartnerStatus | 'deleted',
    reason: user?.partnerStatusReason ?? null,
    since: user?.partnerStatusAt?.toISOString() ?? null,
    openWarnings: notes.filter((n) => n.kind === 'warning' && !n.resolvedAt).length,
    history: notes.map((n) => serializeNote(n, authors.get(n.createdBy.toString()))),
  }
}

/** What the partner sees: no author names of the team. */
export async function myStanding(ownerId: string) {
  const s = await standing(ownerId)
  return { ...s, history: s.history.map((n) => ({ ...n, author: null })) }
}

/** Partners can't put anything back online while the platform has them paused. */
export async function assertNotSuspended(business: { suspended?: boolean }) {
  if (business.suspended) {
    throw ApiError.forbidden('Tvoj partnerski nalog je pauziran. Ponude se ne mogu objaviti dok tim Zalogaj ne ukloni pauzu.', 'PARTNER_SUSPENDED')
  }
}
