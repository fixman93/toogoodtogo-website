/**
 * "Postani partner": a customer applies, an admin approves (→ role "business")
 * or rejects. One pending application per user.
 */
import { PartnerApplication, User, type ApplicationStatus, type Category } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import type { Actor } from './access.service.js'
import { audit } from './audit.service.js'
import { notify } from './notification.service.js'

type ApplicationInput = {
  businessName: string
  contactName: string
  phone: string
  city: string
  countryCode?: string
  category: Category
  locationsCount: number
  message?: string
}

function serialize(a: InstanceType<typeof PartnerApplication>, user?: { name: string; email: string } | null) {
  return {
    id: a.id as string,
    businessName: a.businessName,
    contactName: a.contactName,
    phone: a.phone,
    city: a.city,
    countryCode: a.countryCode ?? null,
    category: a.category,
    locationsCount: a.locationsCount,
    message: a.message,
    status: a.status,
    reviewNote: a.reviewNote,
    reviewedAt: a.reviewedAt?.toISOString(),
    createdAt: a.createdAt.toISOString(),
    ...(user ? { user: { id: a.user.toString(), name: user.name, email: user.email } } : {}),
  }
}

export async function create(input: ApplicationInput, actor: Actor) {
  if (actor.role !== 'customer') throw ApiError.conflict('Tvoj nalog već ima pristup portalu za partnere.', 'ALREADY_PARTNER')
  if (await PartnerApplication.exists({ user: actor.id, status: 'pending' })) {
    throw ApiError.conflict('Već imaš prijavu koja čeka odobrenje.', 'APPLICATION_PENDING')
  }
  const application = await PartnerApplication.create({ ...input, user: actor.id })
  // Everyone who may approve applications (super admin + operations).
  const admins = await User.find({ role: { $in: ['admin', 'operations'] }, deletedAt: null }).select('_id').lean()
  void notify(
    admins.map((a) => a._id),
    { type: 'application_new', title: `Nova prijava partnera: ${input.businessName}`, body: `${input.city} · ${input.contactName}`, link: '/admin?tab=applications' },
  )
  return serialize(application)
}

export async function mine(actor: Actor) {
  const latest = await PartnerApplication.findOne({ user: actor.id }).sort({ createdAt: -1 })
  return latest ? serialize(latest) : null
}

export async function adminList(status: ApplicationStatus | undefined, page: number, limit: number) {
  const filter = status ? { status } : {}
  const [items, total] = await Promise.all([
    PartnerApplication.find(filter).sort({ status: 1, createdAt: -1 }).skip((page - 1) * limit).limit(limit),
    PartnerApplication.countDocuments(filter),
  ])
  const users = new Map((await User.find({ _id: { $in: items.map((a) => a.user) } }).select('name email').lean()).map((u) => [u._id.toString(), u]))
  return { items: items.map((a) => serialize(a, users.get(a.user.toString()) ?? null)), meta: { page, limit, total } }
}

export async function decide(id: string, decision: { status: 'approved' | 'rejected'; note?: string }, actor: Actor) {
  const application = await PartnerApplication.findOneAndUpdate(
    { _id: id, status: 'pending' },
    { $set: { status: decision.status, reviewNote: decision.note, reviewedBy: actor.id, reviewedAt: new Date() } },
    { new: true },
  )
  if (!application) throw ApiError.conflict('Prijava je već obrađena ili ne postoji.', 'APPLICATION_NOT_PENDING')

  if (decision.status === 'approved') {
    // Only promote customers; never downgrade an admin.
    await User.updateOne({ _id: application.user, role: 'customer' }, { $set: { role: 'business' } })
    void notify([application.user], {
      type: 'application_approved',
      title: 'Dobro došao među partnere!',
      body: 'Tvoja prijava je odobrena. Dodaj prvu lokaciju i ponudu u portalu za partnere.',
      link: '/business',
    }, { email: true })
  } else {
    void notify([application.user], {
      type: 'application_rejected',
      title: 'Prijava za partnera nije odobrena',
      body: decision.note || 'Javi nam se ako imaš pitanja.',
      link: '/partner/apply',
    }, { email: true })
  }
  void audit(actor, {
    action: `application.${decision.status}`,
    targetType: 'application',
    targetId: application._id,
    summary: `${decision.status === 'approved' ? 'Odobrena' : 'Odbijena'} prijava: ${application.businessName}`,
    details: decision.note ? { note: decision.note } : undefined,
  })
  const user = await User.findById(application.user).select('name email').lean()
  return serialize(application, user)
}
