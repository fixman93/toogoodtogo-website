/**
 * Grant a role to an existing account (self-registration always creates
 * customers). Works against whatever MONGODB_URI is configured.
 *
 *   npm run set-role -- someone@example.com business   # partner
 *   npm run set-role -- someone@example.com admin
 */
import mongoose from 'mongoose'
import { connectDatabase, disconnectDatabase } from '../config/db.js'
import { ROLES, User, type Role } from '../models/index.js'

async function main() {
  const [email, role] = process.argv.slice(2)
  if (!email || !ROLES.includes(role as Role)) {
    throw new Error(`Usage: npm run set-role -- <email> <${ROLES.join('|')}>`)
  }
  await connectDatabase()
  const user = await User.findOneAndUpdate({ email: email.toLowerCase() }, { role }, { new: true })
  if (!user) throw new Error(`No account with e-mail ${email}. Register it in the app first.`)
  console.log(`✅ ${user.email} is now "${user.role}". Reload the app to see the change.`)
}

main()
  .catch((error) => {
    console.error('❌', error instanceof Error ? error.message : error)
    process.exitCode = 1
  })
  .finally(() => (mongoose.connection.readyState ? disconnectDatabase() : undefined))
