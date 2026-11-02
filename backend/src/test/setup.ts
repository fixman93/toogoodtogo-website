// Runs before any test file is imported — config/env.ts validates at import
// time and exits the process if these are missing, so they must exist first.
process.env.MONGODB_URI ??= 'mongodb://127.0.0.1:27017/foodnesi-test'
process.env.JWT_SECRET ??= 'test-only-secret-at-least-32-characters-long'
// A standalone mongodb-memory-server instance isn't a replica set — no multi-doc transactions.
process.env.MONGODB_TRANSACTIONS ??= 'off'
