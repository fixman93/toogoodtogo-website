/**
 * Creates (or refreshes) the two demo accounts for Apple App Review: a plain
 * customer and an already-approved partner, so reviewers don't have to
 * register + wait for admin approval themselves. Safe to re-run — it only
 * touches these two accounts and the one demo location/offers below.
 *
 *   npm run review:apple
 *
 * The demo location is created with isActive:false and its offers are
 * 'paused', so it never shows up to real customers in search/map — the
 * partner account can still see and manage it in the portal, and can flip
 * it live itself (same toggle any real partner has) to test publishing.
 */
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../config/db.js'
import { LEGAL_VERSIONS } from '../config/legal.js'
import { MARKETS } from '../config/markets.js'
import { Business, Offer, User, type LegalAcceptance } from '../models/index.js'
import { zonedTime } from '../utils/time.js'

const PASSWORD = process.env.APPLE_REVIEW_PASSWORD ?? 'AppleReview2026!'
const CUSTOMER_EMAIL = 'apple.customer@fixman-app.online'
const PARTNER_EMAIL = 'apple.partner@fixman-app.online'
const DEMO_SLUG = 'apple-review-demo-pekara'

async function upsertUser(email: string, name: string, role: 'customer' | 'business', passwordHash: string) {
  const market = MARKETS.RS
  const legalAcceptances: LegalAcceptance[] = [{ document: 'terms', version: LEGAL_VERSIONS.terms, acceptedAt: new Date(), privacyVersion: LEGAL_VERSIONS.privacy }]
  if (role === 'business') legalAcceptances.push({ document: 'partner_terms', version: LEGAL_VERSIONS.partnerTerms, acceptedAt: new Date() })

  let user = await User.findOne({ email })
  if (!user) {
    user = new User({
      name,
      email,
      passwordHash,
      role,
      countryCode: market.code,
      locale: market.locale,
      staffOf: [],
      notificationPrefs: { push: true, email: true },
      points: 0,
      referralRewarded: false,
      streakRewarded: 0,
      legalAcceptances,
    })
  } else {
    user.set({ name, passwordHash, role, isBlocked: false, legalAcceptances })
  }
  if (role === 'business') {
    user.set({ partnerStatus: 'active', partnerStatusAt: new Date(), 'partnerOnboarding.activationMail': { status: 'skipped', roleChangedAt: new Date(), attempts: 0 } })
  }
  await user.save()
  return user
}

async function upsertDemoBusiness(ownerId: mongoose.Types.ObjectId) {
  const market = MARKETS.RS
  const fields = {
    owner: ownerId,
    name: 'Apple Review Demo Pekara',
    slug: DEMO_SLUG,
    category: 'bakery' as const,
    description: 'Demo lokacija za Apple App Review. Nije prava radnja — vidljiva samo nalogu partnera, sakrivena od pretrage i mape.',
    phone: '+381 11 000 0000',
    address: { street: 'Demo adresa 1', city: 'Beograd', postalCode: '11000', countryCode: market.code },
    location: { type: 'Point' as const, coordinates: [20.4651, 44.8048] as [number, number] },
    timezone: market.timezone,
    currency: market.currency,
    collectionInstructions: 'Demo lokacija — nema stvarno preuzimanje.',
    openingHours: 'Pon–Ned 0–24 (demo)',
    isActive: false,
    suspended: false,
  }
  let business = await Business.findOne({ owner: ownerId, slug: DEMO_SLUG })
  if (!business) business = new Business(fields)
  else business.set(fields)
  await business.save()
  return business
}

async function refreshDemoOffers(business: InstanceType<typeof Business>) {
  await Offer.deleteMany({ business: business._id })
  const market = MARKETS.RS
  const now = new Date()
  const templates = [
    { title: 'Mix peciva i hleba', description: 'Demo ponuda za Apple App Review.', price: 350, original: 900, qty: 5, from: '18:00', to: '19:00', day: 1 },
    { title: 'Kifle i somun', description: 'Demo ponuda za Apple App Review.', price: 300, original: 700, qty: 4, from: '17:30', to: '18:30', day: 2 },
  ]
  for (const t of templates) {
    await Offer.create({
      business: business._id,
      title: t.title,
      description: t.description,
      category: business.category,
      contentType: 'surprise',
      priceMinor: t.price * 100,
      originalPriceMinor: t.original * 100,
      currency: market.currency,
      quantityTotal: t.qty,
      quantityAvailable: t.qty,
      maxPerReservation: 2,
      pickupStart: zonedTime(t.day, t.from, market.timezone, now),
      pickupEnd: zonedTime(t.day, t.to, market.timezone, now),
      timezone: market.timezone,
      status: 'paused',
      location: business.location,
      businessName: business.name,
      city: business.address.city,
    })
  }
}

async function main() {
  await connectDatabase()
  const passwordHash = await bcrypt.hash(PASSWORD, 12)

  const customer = await upsertUser(CUSTOMER_EMAIL, 'Apple Reviewer', 'customer', passwordHash)
  const partner = await upsertUser(PARTNER_EMAIL, 'Apple Partner Demo', 'business', passwordHash)
  const business = await upsertDemoBusiness(partner._id)
  await refreshDemoOffers(business)

  console.log('✅ Apple review accounts ready.')
  console.log(`   Customer: ${customer.email} / ${PASSWORD}`)
  console.log(`   Partner:  ${partner.email} / ${PASSWORD}`)
  console.log(`   Demo location "${business.name}" is hidden from public search (isActive:false) with 2 paused demo offers.`)
}

main()
  .catch((error) => {
    console.error('❌', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => (mongoose.connection.readyState ? disconnectDatabase() : undefined))
