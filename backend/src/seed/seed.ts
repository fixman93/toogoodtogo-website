/**
 * Resets the database to a clean TEST state: one test partner with three
 * locations and offers for the next days, plus one test customer.
 *
 *   npm run seed
 *
 * Safety: refuses when NODE_ENV=production, and refuses to wipe a database
 * that contains any account other than the test accounts (i.e. real users),
 * unless run with --force. Password: SEED_PASSWORD, or a random one that is
 * printed at the end.
 */
import { randomBytes } from 'node:crypto'
import bcrypt from 'bcryptjs'
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../config/db.js'
import { env } from '../config/env.js'
import { getMarket } from '../config/markets.js'
import { Business, Favorite, Offer, Reservation, Review, User } from '../models/index.js'
import { slugify } from '../utils/text.js'
import { zonedTime } from '../utils/time.js'
import { SEED_DAYS, TEST_CUSTOMER, TEST_EMAILS, TEST_PARTNER, testLocations, testOfferTemplates } from './data.js'

async function seed() {
  if (env.NODE_ENV === 'production') throw new Error('Refusing to seed with NODE_ENV=production.')
  await connectDatabase()

  const realUsers = await User.countDocuments({ email: { $nin: TEST_EMAILS } })
  if (realUsers > 0 && !process.argv.includes('--force')) {
    throw new Error(`Database has ${realUsers} non-test account(s). Refusing to wipe it (use --force only if you are sure).`)
  }

  const market = getMarket('RS')
  const tz = market.timezone
  const now = new Date()

  await mongoose.connection.dropDatabase()
  await Promise.all([User, Business, Offer, Reservation, Favorite, Review].map((m) => m.syncIndexes()))

  const password = process.env.SEED_PASSWORD ?? randomBytes(6).toString('base64url')
  const passwordHash = await bcrypt.hash(password, 12)
  const partner = await User.create({ ...TEST_PARTNER, passwordHash })
  await User.create({ ...TEST_CUSTOMER, passwordHash })

  const locations = await Promise.all(
    testLocations.map((l) =>
      Business.create({
        owner: partner._id,
        name: l.name,
        slug: slugify(l.name),
        category: l.category,
        description: l.description,
        phone: l.phone,
        logoUrl: l.logo,
        coverUrl: l.cover,
        address: { street: l.street, city: l.city, postalCode: l.postalCode, countryCode: market.code },
        location: { type: 'Point', coordinates: [l.lng, l.lat] },
        timezone: tz,
        currency: market.currency,
        collectionInstructions: l.instructions,
      }),
    ),
  )

  let offerCount = 0
  for (const [index, business] of locations.entries()) {
    for (const template of testOfferTemplates) {
      if (template.locations && !template.locations.includes(index)) continue
      for (let day = 0; day < SEED_DAYS; day++) {
        const pickupEnd = zonedTime(day, template.to, tz, now)
        if (pickupEnd <= now) continue // today's window already over
        await Offer.create({
          business: business._id,
          title: template.title,
          description: template.description,
          category: template.category,
          imageUrl: business.coverUrl,
          tags: template.tags ?? [],
          priceMinor: template.price * 100,
          originalPriceMinor: template.original * 100,
          currency: market.currency,
          quantityTotal: template.quantity,
          quantityAvailable: template.quantity,
          maxPerReservation: Math.min(2, template.quantity),
          pickupStart: zonedTime(day, template.from, tz, now),
          pickupEnd,
          timezone: tz,
          location: business.location,
          businessName: business.name,
          city: business.address.city,
        })
        offerCount++
      }
    }
  }

  console.log(`🌱 Test data: 1 partner, ${locations.length} locations, ${offerCount} offers (next ${SEED_DAYS} days), 1 customer.`)
  console.log(`   Partner:  ${TEST_PARTNER.email}`)
  console.log(`   Customer: ${TEST_CUSTOMER.email}`)
  console.log(`   Password (both): ${password}`)
}

seed()
  .catch((error) => {
    console.error('❌ Seed failed:', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => (mongoose.connection.readyState ? disconnectDatabase() : undefined))
