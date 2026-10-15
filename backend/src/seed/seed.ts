/**
 * Resets the database to a realistic demo state.
 *   npm run seed            (refuses to run when NODE_ENV=production)
 * Demo password for every seeded account: SEED_PASSWORD or "lozinka123".
 */
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../config/db.js'
import { env } from '../config/env.js'
import { getMarket } from '../config/markets.js'
import { Business, Favorite, Offer, Reservation, Review, User } from '../models/index.js'
import { pickupCode, slugify } from '../utils/text.js'
import { zonedTime } from '../utils/time.js'
import { categoryDescriptions, seedBusinesses, seedOffers, seedReviewComments, seedUsers } from './data.js'

async function seed() {
  if (env.NODE_ENV === 'production') throw new Error('Refusing to seed a production database.')
  await connectDatabase()
  const market = getMarket('RS')
  const tz = market.timezone
  const now = new Date()

  await mongoose.connection.dropDatabase()
  await Promise.all([User, Business, Offer, Reservation, Favorite, Review].map((m) => m.syncIndexes()))

  const passwordHash = await bcrypt.hash(process.env.SEED_PASSWORD ?? 'lozinka123', 12)
  const users = Object.fromEntries(
    await Promise.all(seedUsers.map(async (u) => [u.key, await User.create({ name: u.name, email: u.email, role: u.role, passwordHash })] as const)),
  )

  const businesses = Object.fromEntries(
    await Promise.all(
      seedBusinesses.map(async (b) => [
        b.key,
        await Business.create({
          owner: users[b.owner]._id,
          name: b.name,
          slug: slugify(b.name),
          category: b.category,
          description: b.description,
          logoUrl: b.logo,
          coverUrl: b.cover,
          address: { street: b.street, city: b.city, postalCode: b.postalCode, countryCode: 'RS' },
          location: { type: 'Point', coordinates: [b.lng, b.lat] },
          timezone: tz,
          currency: market.currency,
          collectionInstructions: b.instructions,
          rating: { average: b.rating[0], count: b.rating[1] },
        }),
      ] as const),
    ),
  )

  const offers = await Promise.all(
    seedOffers.map(([key, title, description, price, original, quantity, available, day, from, to, reserved, tags]) => {
      const business = businesses[key]
      // Roll today's offers whose window already passed to tomorrow, so the demo always has live offers.
      const dayOffset = zonedTime(day, to, tz, now) <= now ? day + 1 : day
      return Offer.create({
        business: business._id,
        title,
        description: description ?? categoryDescriptions[business.category],
        category: business.category,
        imageUrl: business.coverUrl,
        tags,
        priceMinor: price * 100,
        originalPriceMinor: original * 100,
        currency: market.currency,
        quantityTotal: quantity,
        quantityAvailable: available,
        maxPerReservation: Math.min(market.maxQuantityPerReservation, quantity),
        pickupStart: zonedTime(dayOffset, from, tz, now),
        pickupEnd: zonedTime(dayOffset, to, tz, now),
        timezone: tz,
        reservedCount: reserved,
        location: business.location,
        businessName: business.name,
        city: business.address.city,
      })
    }),
  )

  // Ana: one upcoming reservation + history (one collected & reviewed, one collected awaiting review, one cancelled).
  const ana = users.ana
  const klasOffer = offers[0]
  await Offer.updateOne({ _id: klasOffer._id }, { $inc: { quantityAvailable: -1 } })
  const snapshot = (offer: (typeof offers)[number], quantity: number) => ({
    offer: offer._id,
    business: offer.business,
    code: pickupCode(),
    quantity,
    unitPriceMinor: offer.priceMinor,
    originalUnitPriceMinor: offer.originalPriceMinor,
    totalMinor: offer.priceMinor * quantity,
    currency: offer.currency,
    offerTitle: offer.title,
    offerImageUrl: offer.imageUrl,
    timezone: tz,
    payment: { status: 'not_required', method: 'pay_at_pickup' },
  })
  await Reservation.create({ ...snapshot(klasOffer, 1), user: ana._id, pickupStart: klasOffer.pickupStart, pickupEnd: klasOffer.pickupEnd, status: 'confirmed' })

  const past = (days: number, hhmm: string) => zonedTime(-days, hhmm, tz, now)
  const reviewed = await Reservation.create({
    ...snapshot(offers[2], 2),
    user: ana._id,
    pickupStart: past(3, '18:00'),
    pickupEnd: past(3, '19:00'),
    status: 'collected',
    collectedAt: past(3, '18:20'),
  })
  await Reservation.create({
    ...snapshot(offers[10], 1),
    user: ana._id,
    pickupStart: past(1, '19:00'),
    pickupEnd: past(1, '20:00'),
    status: 'collected',
    collectedAt: past(1, '19:15'),
  })
  await Reservation.create({
    ...snapshot(offers[9], 1),
    user: ana._id,
    pickupStart: past(9, '20:30'),
    pickupEnd: past(9, '21:00'),
    status: 'cancelled',
    cancelledAt: past(9, '15:00'),
    cancelledBy: 'customer',
  })

  // Sample reviews (the business rating aggregates were seeded above).
  await Review.create({ user: ana._id, business: reviewed.business, reservation: reviewed._id, rating: 5, comment: seedReviewComments[0] })
  for (const [i, key] of ['klas', 'secerko', 'zelena'].entries()) {
    const offer = offers.find((o) => o.business.equals(businesses[key]._id))!
    const r = await Reservation.create({
      ...snapshot(offer, 1),
      user: users.jelena._id,
      pickupStart: past(5 + i, '19:00'),
      pickupEnd: past(5 + i, '20:00'),
      status: 'collected',
      collectedAt: past(5 + i, '19:10'),
    })
    await Review.create({ user: users.jelena._id, business: offer.business, reservation: r._id, rating: 4 + (i % 2), comment: seedReviewComments[(i + 1) % 3] })
  }

  await Favorite.create([
    { user: ana._id, targetType: 'business', targetId: businesses.zrno._id },
    { user: ana._id, targetType: 'business', targetId: businesses.secerko._id },
  ])

  console.log(`🌱 Seeded ${seedUsers.length} users, ${seedBusinesses.length} businesses, ${offers.length} offers.`)
  console.log('   Demo logins (password: lozinka123): ana@primer.rs (customer), marko@pekaraklas.rs (business), admin@zalogaj.rs (admin)')
}

seed()
  .catch((error) => {
    console.error('❌ Seed failed:', error)
    process.exitCode = 1
  })
  .finally(() => (mongoose.connection.readyState ? disconnectDatabase() : undefined))
