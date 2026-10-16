import { Business, Donation } from '../models/index.js'
import { ApiError } from '../utils/ApiError.js'
import { assertBusinessAccess, type Actor } from './access.service.js'
import { workplaceIds } from './access.service.js'

type DonationDoc = InstanceType<typeof Donation>

function serialize(d: DonationDoc, businessName?: string) {
  return {
    id: d.id as string,
    businessId: d.business.toString(),
    businessName,
    date: d.date.toISOString(),
    organization: d.organization,
    bags: d.bags,
    weightKg: d.weightKg,
    items: d.items,
    pickedUpBy: d.pickedUpBy,
    note: d.note,
    createdAt: d.createdAt.toISOString(),
  }
}

async function withNames(donations: DonationDoc[]) {
  const names = new Map((await Business.find({ _id: { $in: donations.map((d) => d.business) } }).select('name').lean()).map((b) => [b._id.toString(), b.name]))
  return donations.map((d) => serialize(d, names.get(d.business.toString())))
}

function totals(donations: DonationDoc[]) {
  return {
    count: donations.length,
    bags: donations.reduce((s, d) => s + (d.bags ?? 0), 0),
    weightKg: Math.round(donations.reduce((s, d) => s + (d.weightKg ?? 0), 0) * 10) / 10,
  }
}

export async function create(
  input: { businessId: string; date: Date; organization: string; bags: number; weightKg?: number; items?: string; pickedUpBy?: string; note?: string },
  actor: Actor,
) {
  const business = await assertBusinessAccess(input.businessId, actor)
  const { businessId: _ignored, ...fields } = input
  void _ignored
  const donation = await Donation.create({ ...fields, business: business._id, recordedBy: actor.id })
  return serialize(donation, business.name)
}

export async function mine(actor: Actor) {
  const donations = await Donation.find({ business: { $in: await workplaceIds(actor) } }).sort({ date: -1 }).limit(200)
  return { totals: totals(donations), items: await withNames(donations) }
}

export async function remove(id: string, actor: Actor) {
  const donation = await Donation.findById(id)
  if (!donation) throw ApiError.notFound('Donacija nije pronađena.')
  await assertBusinessAccess(donation.business, actor)
  await donation.deleteOne()
}

export async function adminList() {
  const donations = await Donation.find().sort({ date: -1 }).limit(500)
  return { totals: totals(donations), items: await withNames(donations) }
}
