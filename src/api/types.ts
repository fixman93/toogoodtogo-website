/**
 * Types mirroring the REST API contract in backend/. Money is always an
 * integer in minor units (e.g. 45000 = 450,00 RSD) plus an ISO currency code.
 * Dates are ISO-8601 UTC strings; display them in the business timezone.
 */

export const CATEGORIES = ['meals', 'bakery', 'groceries', 'sweets'] as const
export type Category = (typeof CATEGORIES)[number]

export type Role = 'customer' | 'business' | 'admin'

export interface ApiSuccess<T> {
  data: T
}

export interface PageMeta {
  page: number
  limit: number
  total: number
}

export interface ApiList<T> {
  data: T[]
  meta: PageMeta
}

export interface ApiErrorBody {
  error: { code: string; message: string; details?: unknown }
}

export interface User {
  id: string
  name: string
  email: string
  role: Role
  locale: string
  countryCode: string
  createdAt: string
}

export interface AuthResult {
  user: User
  token: string
}

export interface Address {
  street: string
  city: string
  postalCode?: string
  countryCode: string
}

export interface GeoPoint {
  lat: number
  lng: number
}

export interface BusinessSummary {
  id: string
  name: string
  category: Category
  logoUrl?: string
  coverUrl?: string
  address: Address
  location: GeoPoint
  timezone: string
  rating: { average: number; count: number }
}

export interface Business extends BusinessSummary {
  description?: string
  collectionInstructions?: string
  phone?: string
  currency: string
  ownerId: string
  isActive: boolean
}

export type OfferStatus = 'active' | 'paused' | 'expired'

export interface Offer {
  id: string
  businessId: string
  business: BusinessSummary
  title: string
  description: string
  category: Category
  imageUrl?: string
  tags: string[]
  priceMinor: number
  originalPriceMinor: number
  currency: string
  quantityTotal: number
  quantityAvailable: number
  maxPerReservation: number
  pickupStart: string
  pickupEnd: string
  timezone: string
  status: OfferStatus
  reservedCount: number
  /** Present when the request included lat/lng. */
  distanceMeters?: number
}

export type OfferSort = 'distance' | 'price' | 'popularity' | 'pickup'
export type PickupDay = 'today' | 'tomorrow'
export type TimeOfDay = 'morning' | 'afternoon' | 'evening'

export interface OfferQuery {
  q?: string
  category?: Category
  businessId?: string
  lat?: number
  lng?: number
  maxDistanceKm?: number
  maxPriceMinor?: number
  pickupDay?: PickupDay
  timeOfDay?: TimeOfDay
  sort?: OfferSort
  page?: number
  limit?: number
}

export type ReservationStatus = 'pending_payment' | 'confirmed' | 'collected' | 'cancelled' | 'expired'
export type PaymentStatus = 'not_required' | 'pending' | 'paid' | 'refunded' | 'failed'

export interface Reservation {
  id: string
  code: string
  status: ReservationStatus
  quantity: number
  unitPriceMinor: number
  originalUnitPriceMinor: number
  totalMinor: number
  currency: string
  pickupStart: string
  pickupEnd: string
  timezone: string
  offer: { id: string; title: string; imageUrl?: string }
  business: BusinessSummary
  payment: { status: PaymentStatus; method: 'pay_at_pickup' | 'online' }
  canCancel: boolean
  /** Only included for the business's own staff. */
  customer?: { name: string }
  cancelledAt?: string
  collectedAt?: string
  createdAt: string
}

export type FavoriteTarget = 'business' | 'offer'

export interface Favorite {
  id: string
  targetType: FavoriteTarget
  targetId: string
  business?: BusinessSummary & { activeOfferCount: number }
  offer?: Offer
  createdAt: string
}

export interface Review {
  id: string
  rating: number
  comment?: string
  user: { id: string; name: string }
  createdAt: string
}

/** Body for POST/PATCH /businesses. */
export interface BusinessInput {
  name: string
  category: Category
  description?: string
  phone?: string
  logoUrl?: string
  coverUrl?: string
  address: Address
  location: GeoPoint
  collectionInstructions?: string
  isActive?: boolean
}

/** Body for POST/PATCH /offers (PATCH omits businessId). */
export interface OfferInput {
  businessId: string
  title: string
  description: string
  category?: Category
  tags?: string[]
  priceMinor: number
  originalPriceMinor: number
  quantityTotal: number
  maxPerReservation?: number
  pickupStart: string
  pickupEnd: string
}

export type OfferPatch = Partial<Omit<OfferInput, 'businessId'>> & { status?: 'active' | 'paused' }
