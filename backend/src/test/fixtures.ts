import { Business, Offer, User } from '../models/index.js'
import type { Actor } from '../services/access.service.js'

let n = 0
const next = () => ++n

export async function makeCustomer(overrides: Partial<{ email: string }> = {}) {
  const i = next()
  const user = await User.create({ name: `Kupac ${i}`, email: overrides.email ?? `kupac${i}@test.local`, passwordHash: 'x', phone: `+3816000000${i}`, role: 'customer' })
  return { user, actor: { id: user.id as string, role: 'customer' } as Actor }
}

export async function makePartner() {
  const i = next()
  const user = await User.create({ name: `Partner ${i}`, email: `partner${i}@test.local`, passwordHash: 'x', role: 'business' })
  const business = await Business.create({
    owner: user._id,
    name: `Test Pekara ${i}`,
    slug: `test-pekara-${i}`,
    category: 'bakery',
    address: { street: 'Test 1', city: 'Beograd', countryCode: 'RS' },
    location: { type: 'Point', coordinates: [20.46, 44.8] },
    timezone: 'Europe/Belgrade',
    currency: 'RSD',
  })
  return { user, business, actor: { id: user.id as string, role: 'business' } as Actor }
}

export async function makeOffer(business: InstanceType<typeof Business>, overrides: Partial<{ priceMinor: number; quantityTotal: number }> = {}) {
  const now = new Date()
  const offer = await Offer.create({
    business: business._id,
    title: 'Mix peciva',
    description: 'Test ponuda.',
    category: business.category,
    priceMinor: overrides.priceMinor ?? 30000,
    originalPriceMinor: 60000,
    currency: business.currency,
    quantityTotal: overrides.quantityTotal ?? 10,
    quantityAvailable: overrides.quantityTotal ?? 10,
    pickupStart: new Date(now.getTime() + 60_000),
    pickupEnd: new Date(now.getTime() + 3_600_000),
    timezone: business.timezone,
    location: business.location,
    businessName: business.name,
    city: business.address.city,
  })
  return offer
}
