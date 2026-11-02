/**
 * Upserts the Foodnesi Rewards catalog + default config. Unlike `npm run
 * seed`, this touches only the `rewards`/`loyaltyconfigs` collections and
 * never wipes anything — safe to run against a live database (e.g. right
 * after deploying this feature, so the catalog exists for the first
 * customer to cross a threshold).
 *
 *   npm run rewards:seed
 */
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../config/db.js'
import { LoyaltyConfig, Reward } from '../models/index.js'
import { REWARD_CATALOG } from '../seed/data.js'

async function main() {
  await connectDatabase()
  for (const reward of REWARD_CATALOG) {
    await Reward.findOneAndUpdate({ key: reward.key }, { $setOnInsert: reward }, { upsert: true })
  }
  await LoyaltyConfig.findByIdAndUpdate('default', { $setOnInsert: { enabled: true, pointsPerBag: 10 } }, { upsert: true, setDefaultsOnInsert: true })
  console.log(`✅ Rewards catalog ready (${REWARD_CATALOG.length} rewards, config untouched if it already existed).`)
}

main()
  .catch((error) => {
    console.error('❌', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => (mongoose.connection.readyState ? disconnectDatabase() : undefined))
