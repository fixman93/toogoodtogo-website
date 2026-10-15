/**
 * Axios adapter that answers API calls from the demo dataset while the real
 * backend is not configured (VITE_API_MODE=mock). It intentionally mirrors
 * only the public REST contract — it is not a second backend. State is kept
 * in localStorage for the current day so reservations survive a reload.
 */
import { AxiosError, type AxiosResponse, type InternalAxiosRequestConfig } from 'axios'
import type { Favorite, Offer, OfferQuery, Reservation, User } from '@/api/types'
import { distanceMeters } from '@/lib/geo'
import { zonedDateParts } from '@/lib/time'
import {
  buildMockOffers,
  buildMockReservations,
  buildMockReviews,
  mockBusinesses,
  mockUsers,
  toSummary,
} from './data'

const STORAGE_KEY = 'zalogaj.mockdb.v1'
const CANCEL_CUTOFF_MINUTES = 30
const LATENCY_MS = 250

type StoredUser = User & { password: string }
interface MockDb {
  day: string
  users: StoredUser[]
  offers: Offer[]
  reservations: (Reservation & { userId: string })[]
  favorites: (Pick<Favorite, 'id' | 'targetType' | 'targetId' | 'createdAt'> & { userId: string })[]
}

function freshDb(): MockDb {
  const offers = buildMockOffers()
  return {
    day: new Date().toDateString(),
    users: mockUsers,
    offers,
    reservations: buildMockReservations(offers),
    favorites: [
      { id: 'f-1', userId: 'u-ana', targetType: 'business', targetId: 'b-zrno', createdAt: new Date().toISOString() },
      { id: 'f-2', userId: 'u-ana', targetType: 'business', targetId: 'b-secerko', createdAt: new Date().toISOString() },
    ],
  }
}

function loadDb(): MockDb {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw) {
      const db = JSON.parse(raw) as MockDb
      if (db.day === new Date().toDateString()) return db
    }
  } catch {
    /* ignore corrupt storage */
  }
  return freshDb()
}

let db = loadDb()
const save = () => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(db))
  } catch {
    /* storage may be unavailable (private mode) */
  }
}

// ---------------------------------------------------------------------------
// helpers

class MockHttpError extends Error {
  readonly status: number
  readonly code: string

  constructor(status: number, code: string, message: string) {
    super(message)
    this.status = status
    this.code = code
  }
}

const fail = (status: number, code: string, message: string): never => {
  throw new MockHttpError(status, code, message)
}

function currentUser(config: InternalAxiosRequestConfig): StoredUser | null {
  const header = String(config.headers?.Authorization ?? '')
  const userId = header.startsWith('Bearer mock.') ? header.slice('Bearer mock.'.length) : null
  return db.users.find((u) => u.id === userId) ?? null
}

function requireUser(config: InternalAxiosRequestConfig) {
  return currentUser(config) ?? fail(401, 'UNAUTHORIZED', 'Potrebna je prijava.')
}

function publicUser(stored: StoredUser): User {
  const user: Partial<StoredUser> = { ...stored }
  delete user.password
  return user as User
}

const paginate = <T,>(items: T[], page = 1, limit = 20) => ({
  data: items.slice((page - 1) * limit, page * limit),
  meta: { page, limit, total: items.length },
})

const withCancelFlag = (r: Reservation): Reservation => ({
  ...r,
  canCancel:
    (r.status === 'confirmed' || r.status === 'pending_payment') &&
    Date.now() < new Date(r.pickupStart).getTime() - CANCEL_CUTOFF_MINUTES * 60_000,
})

function ownsBusiness(user: StoredUser, businessId: string) {
  return user.role === 'admin' || mockBusinesses.some((b) => b.id === businessId && b.ownerId === user.id)
}

function forStaff(r: MockDb['reservations'][number]): Reservation {
  return { ...withCancelFlag(r), customer: { name: db.users.find((u) => u.id === r.userId)?.name ?? 'Kupac' } }
}

const COLLECT_ERRORS: Partial<Record<Reservation['status'], [string, string]>> = {
  collected: ['ALREADY_COLLECTED', 'Ova rezervacija je već preuzeta.'],
  cancelled: ['RESERVATION_CANCELLED', 'Ova rezervacija je otkazana.'],
  expired: ['RESERVATION_EXPIRED', 'Ova rezervacija je istekla.'],
  pending_payment: ['PAYMENT_PENDING', 'Rezervacija još nije plaćena.'],
}

function markCollected(r: MockDb['reservations'][number]) {
  const error = COLLECT_ERRORS[r.status]
  if (error) fail(409, error[0], error[1])
  r.status = 'collected'
  r.collectedAt = new Date().toISOString()
  if (r.payment.method === 'pay_at_pickup') r.payment = { ...r.payment, status: 'paid' }
  save()
  return forStaff(r)
}

function queryOffers(query: OfferQuery) {
  const now = Date.now()
  const origin = query.lat != null && query.lng != null ? { lat: Number(query.lat), lng: Number(query.lng) } : null
  const q = query.q?.trim().toLowerCase()
  const todayKey = zonedDateParts(new Date(), 'Europe/Belgrade').day

  let items = db.offers
    .filter((o) => o.status === 'active' && new Date(o.pickupEnd).getTime() > now)
    .map((o) => (origin ? { ...o, distanceMeters: Math.round(distanceMeters(origin, o.business.location)) } : o))
    .filter((o) => {
      if (query.category && o.category !== query.category) return false
      if (query.businessId && o.businessId !== query.businessId) return false
      if (query.maxPriceMinor && o.priceMinor > Number(query.maxPriceMinor)) return false
      if (query.maxDistanceKm && o.distanceMeters != null && o.distanceMeters > Number(query.maxDistanceKm) * 1000) return false
      if (q) {
        const haystack = `${o.title} ${o.business.name} ${o.business.address.street} ${o.business.address.city}`.toLowerCase()
        if (!haystack.includes(q)) return false
      }
      const local = zonedDateParts(new Date(o.pickupStart), o.timezone)
      if (query.pickupDay === 'today' && local.day !== todayKey) return false
      if (query.pickupDay === 'tomorrow' && local.day === todayKey) return false
      if (query.timeOfDay === 'morning' && local.hour >= 12) return false
      if (query.timeOfDay === 'afternoon' && (local.hour < 12 || local.hour >= 17)) return false
      if (query.timeOfDay === 'evening' && local.hour < 17) return false
      return true
    })

  const sort = query.sort ?? (origin ? 'distance' : 'pickup')
  const byPickup = (a: Offer, b: Offer) => a.pickupStart.localeCompare(b.pickupStart)
  const comparators: Record<string, (a: Offer, b: Offer) => number> = {
    distance: (a, b) => (a.distanceMeters ?? 0) - (b.distanceMeters ?? 0),
    price: (a, b) => a.priceMinor - b.priceMinor,
    popularity: (a, b) => b.reservedCount - a.reservedCount,
    pickup: byPickup,
  }
  // Sold-out offers stay visible (like in store windows) but sink to the bottom.
  items = [...items].sort(
    (a, b) => Number(a.quantityAvailable === 0) - Number(b.quantityAvailable === 0) || comparators[sort](a, b),
  )
  return paginate(items, Number(query.page ?? 1), Number(query.limit ?? 20))
}

function expandFavorite(f: MockDb['favorites'][number]): Favorite {
  if (f.targetType === 'business') {
    const business = mockBusinesses.find((b) => b.id === f.targetId)
    const activeOfferCount = db.offers.filter((o) => o.businessId === f.targetId && o.quantityAvailable > 0).length
    return { ...f, business: business ? { ...toSummary(business), activeOfferCount } : undefined }
  }
  return { ...f, offer: db.offers.find((o) => o.id === f.targetId) }
}

function code() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
  return 'ZL-' + Array.from({ length: 4 }, () => chars[Math.floor(Math.random() * chars.length)]).join('')
}

// ---------------------------------------------------------------------------
// routes

type Handler = (ctx: {
  config: InternalAxiosRequestConfig
  params: string[]
  body: Record<string, unknown>
  query: Record<string, unknown>
}) => { status?: number; data: unknown }

const routes: [string, RegExp, Handler][] = [
  ['POST', /^\/auth\/login$/, ({ body }) => {
    const user = db.users.find((u) => u.email === String(body.email).toLowerCase() && u.password === body.password)
    if (!user) fail(401, 'INVALID_CREDENTIALS', 'Pogrešna e-pošta ili lozinka.')
    return { data: { data: { user: publicUser(user!), token: `mock.${user!.id}` } } }
  }],
  ['POST', /^\/auth\/register$/, ({ body }) => {
    const email = String(body.email ?? '').toLowerCase()
    if (db.users.some((u) => u.email === email)) fail(409, 'EMAIL_TAKEN', 'Nalog sa ovom e-poštom već postoji.')
    if (String(body.password ?? '').length < 8) fail(400, 'VALIDATION_ERROR', 'Lozinka mora imati najmanje 8 karaktera.')
    const user: StoredUser = {
      id: `u-${Date.now()}`,
      name: String(body.name),
      email,
      password: String(body.password),
      role: 'customer',
      locale: 'sr-Latn-RS',
      countryCode: 'RS',
      createdAt: new Date().toISOString(),
    }
    db.users = [...db.users, user]
    save()
    return { status: 201, data: { data: { user: publicUser(user), token: `mock.${user.id}` } } }
  }],
  ['GET', /^\/auth\/me$/, ({ config }) => ({ data: { data: publicUser(requireUser(config)) } })],

  ['GET', /^\/offers$/, ({ query }) => ({ data: queryOffers(query as OfferQuery) })],
  ['GET', /^\/offers\/([\w-]+)$/, ({ params }) => {
    const offer = db.offers.find((o) => o.id === params[0]) ?? fail(404, 'NOT_FOUND', 'Ponuda nije pronađena.')
    return { data: { data: offer } }
  }],

  ['GET', /^\/businesses$/, ({ config, query }) => {
    let items = mockBusinesses
    if (query.owner === 'me') items = items.filter((b) => b.ownerId === requireUser(config).id)
    return { data: paginate(items) }
  }],
  ['GET', /^\/businesses\/([\w-]+)$/, ({ params }) => {
    const business = mockBusinesses.find((b) => b.id === params[0]) ?? fail(404, 'NOT_FOUND', 'Lokal nije pronađen.')
    return { data: { data: business } }
  }],
  ['GET', /^\/businesses\/([\w-]+)\/reviews$/, ({ params }) => ({ data: paginate(buildMockReviews(params[0])) })],

  ['GET', /^\/reservations$/, ({ config, query }) => {
    const user = requireUser(config)
    let items = query.businessId
      ? db.reservations.filter((r) => r.business.id === query.businessId && ownsBusiness(user, r.business.id)).map(forStaff)
      : db.reservations.filter((r) => r.userId === user.id).map(withCancelFlag)
    const active = (r: Reservation) => r.status === 'confirmed' || r.status === 'pending_payment'
    if (query.scope === 'upcoming') items = items.filter(active).sort((a, b) => a.pickupStart.localeCompare(b.pickupStart))
    if (query.scope === 'history') items = items.filter((r) => !active(r)).sort((a, b) => b.pickupStart.localeCompare(a.pickupStart))
    return { data: paginate(items) }
  }],
  ['GET', /^\/reservations\/([\w-]+)$/, ({ config, params }) => {
    const user = requireUser(config)
    const r = db.reservations.find((x) => x.id === params[0] && x.userId === user.id) ?? fail(404, 'NOT_FOUND', 'Rezervacija nije pronađena.')
    return { data: { data: withCancelFlag(r) } }
  }],
  ['POST', /^\/reservations\/collect$/, ({ config, body }) => {
    const user = requireUser(config)
    const raw = String(body.code ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '').replace(/^ZL/, '')
    if (raw.length !== 4) fail(400, 'VALIDATION_ERROR', 'Kod ima 4 znaka (npr. ZL-4F7K).')
    const matches = db.reservations.filter(
      (r) => r.code === `ZL-${raw}` && ownsBusiness(user, r.business.id) && (!body.reservationId || r.id === body.reservationId),
    )
    if (!matches.length) fail(404, 'CODE_NOT_FOUND', 'Kod nije pronađen u vašim lokalima.')
    const collectable = matches.filter((r) => r.status === 'confirmed')
    if (collectable.length > 1) fail(409, 'AMBIGUOUS_CODE', 'Više rezervacija ima isti kod. Skenirajte QR kod.')
    return { data: { data: markCollected(collectable[0] ?? matches[0]) } }
  }],
  ['PATCH', /^\/reservations\/([\w-]+)\/collect$/, ({ config, params }) => {
    const user = requireUser(config)
    const r = db.reservations.find((x) => x.id === params[0] && ownsBusiness(user, x.business.id)) ?? fail(404, 'NOT_FOUND', 'Rezervacija nije pronađena.')
    return { data: { data: markCollected(r) } }
  }],
  ['POST', /^\/reservations$/, ({ config, body }) => {
    const user = requireUser(config)
    const quantity = Number(body.quantity ?? 1)
    const offer = db.offers.find((o) => o.id === body.offerId) ?? fail(404, 'NOT_FOUND', 'Ponuda nije pronađena.')
    if (quantity < 1 || quantity > offer.maxPerReservation) fail(400, 'INVALID_QUANTITY', `Možeš rezervisati najviše ${offer.maxPerReservation}.`)
    if (offer.quantityAvailable < quantity) fail(409, 'SOLD_OUT', 'Nema dovoljno dostupnih kesa.')
    offer.quantityAvailable -= quantity
    offer.reservedCount += quantity
    const reservation: Reservation & { userId: string } = {
      id: `r-${Date.now()}`,
      userId: user.id,
      code: code(),
      status: 'confirmed',
      quantity,
      unitPriceMinor: offer.priceMinor,
      originalUnitPriceMinor: offer.originalPriceMinor,
      totalMinor: offer.priceMinor * quantity,
      currency: offer.currency,
      pickupStart: offer.pickupStart,
      pickupEnd: offer.pickupEnd,
      timezone: offer.timezone,
      offer: { id: offer.id, title: offer.title, imageUrl: offer.imageUrl },
      business: offer.business,
      payment: { status: 'not_required', method: 'pay_at_pickup' },
      canCancel: true,
      createdAt: new Date().toISOString(),
    }
    db.reservations = [reservation, ...db.reservations]
    save()
    return { status: 201, data: { data: withCancelFlag(reservation) } }
  }],
  ['PATCH', /^\/reservations\/([\w-]+)\/cancel$/, ({ config, params }) => {
    const user = requireUser(config)
    const r = db.reservations.find((x) => x.id === params[0] && x.userId === user.id) ?? fail(404, 'NOT_FOUND', 'Rezervacija nije pronađena.')
    if (!withCancelFlag(r).canCancel) fail(409, 'CANCELLATION_NOT_ALLOWED', 'Rezervacija se više ne može otkazati.')
    r.status = 'cancelled'
    r.cancelledAt = new Date().toISOString()
    const offer = db.offers.find((o) => o.id === r.offer.id)
    if (offer) offer.quantityAvailable += r.quantity
    save()
    return { data: { data: withCancelFlag(r) } }
  }],

  ['GET', /^\/favorites$/, ({ config }) => {
    const user = requireUser(config)
    return { data: paginate(db.favorites.filter((f) => f.userId === user.id).map(expandFavorite)) }
  }],
  ['POST', /^\/favorites$/, ({ config, body }) => {
    const user = requireUser(config)
    const existing = db.favorites.find((f) => f.userId === user.id && f.targetType === body.targetType && f.targetId === body.targetId)
    if (existing) return { data: { data: expandFavorite(existing) } }
    const favorite = {
      id: `f-${Date.now()}`,
      userId: user.id,
      targetType: body.targetType as Favorite['targetType'],
      targetId: String(body.targetId),
      createdAt: new Date().toISOString(),
    }
    db.favorites = [...db.favorites, favorite]
    save()
    return { status: 201, data: { data: expandFavorite(favorite) } }
  }],
  ['DELETE', /^\/favorites\/([\w-]+)$/, ({ config, params }) => {
    const user = requireUser(config)
    db.favorites = db.favorites.filter((f) => !(f.id === params[0] && f.userId === user.id))
    save()
    return { status: 204, data: '' }
  }],
]

export async function handleMockRequest(config: InternalAxiosRequestConfig): Promise<AxiosResponse> {
  await new Promise((resolve) => setTimeout(resolve, LATENCY_MS))
  const method = (config.method ?? 'get').toUpperCase()
  const path = (config.url ?? '').replace(/^https?:\/\/[^/]+/, '').replace(/^\/api/, '').split('?')[0]
  const body = typeof config.data === 'string' && config.data ? JSON.parse(config.data) : (config.data ?? {})
  const query = (config.params ?? {}) as Record<string, unknown>

  const respond = (status: number, data: unknown): AxiosResponse => ({ status, statusText: String(status), data, headers: {}, config })

  try {
    for (const [routeMethod, pattern, handler] of routes) {
      const match = method === routeMethod ? pattern.exec(path) : null
      if (match) {
        const result = handler({ config, params: match.slice(1), body, query })
        return respond(result.status ?? 200, result.data)
      }
    }
    fail(404, 'NOT_FOUND', `Mock ruta ne postoji: ${method} ${path}`)
  } catch (error) {
    const e = error instanceof MockHttpError ? error : new MockHttpError(500, 'INTERNAL', String(error))
    const response = respond(e.status, { error: { code: e.code, message: e.message } })
    throw new AxiosError(e.message, String(e.status), config, null, response)
  }
  throw new Error('unreachable')
}

/** Reset demo state (used from the profile page). */
export function resetMockDb() {
  db = freshDb()
  save()
}
