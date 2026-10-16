/**
 * Types mirroring the REST API contract in backend/. Money is always an
 * integer in minor units (e.g. 45000 = 450,00 RSD) plus an ISO currency code.
 * Dates are ISO-8601 UTC strings; display them in the business timezone.
 */

export const CATEGORIES = ['meals', 'bakery', 'groceries', 'sweets'] as const
export type Category = (typeof CATEGORIES)[number]

/** The 14 allergens that must be declared (EU/Serbia). */
export const ALLERGENS = ['gluten', 'crustaceans', 'eggs', 'fish', 'peanuts', 'soy', 'milk', 'nuts', 'celery', 'mustard', 'sesame', 'sulphites', 'lupin', 'molluscs'] as const
export type Allergen = (typeof ALLERGENS)[number]

export type Role = 'customer' | 'business' | 'staff' | 'admin' | 'operations' | 'support' | 'finance'

/** Platform team roles (admin panel). */
export const PLATFORM_ROLES: Role[] = ['admin', 'operations', 'support', 'finance']

export type Permission =
  | 'stats.view'
  | 'users.view'
  | 'users.roles'
  | 'users.block'
  | 'applications.manage'
  | 'businesses.moderate'
  | 'partners.manage'
  | 'reservations.view'
  | 'reviews.moderate'
  | 'support.manage'
  | 'promotions.manage'
  | 'finance.view'
  | 'finance.manage'
  | 'donations.view'
  | 'audit.view'

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
  avatarUrl?: string
  staffOf: string[]
  permissions: Permission[]
  notificationPrefs: { push: boolean; email: boolean }
  /** Only on GET /auth/me */
  points?: number
  level?: { key: string; name: string; nextAt: number | null; nextName: string | null }
  referralCode?: string | null
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
  openingHours?: string
  createdAt?: string
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
  /** 'surprise' = classic surprise bag; 'known' = exact contents listed. */
  contentType: 'surprise' | 'known'
  contents: string[]
  allergens: Allergen[]
  /** Price right now (dynamic pricing applied). */
  priceMinor: number
  basePriceMinor?: number
  /** Scheduled automatic price drop. */
  priceDrop?: { at: string; priceMinor: number }
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

export type OfferSort = 'distance' | 'price' | 'popularity' | 'pickup' | 'rating'
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
  discountMinor?: number
  promoCode?: string
  currency: string
  pickupStart: string
  pickupEnd: string
  timezone: string
  offer: { id: string; title: string; imageUrl?: string }
  business: BusinessSummary
  payment: { status: PaymentStatus; method: 'pay_at_pickup' | 'online' }
  canCancel: boolean
  /** Collected and already reviewed by the customer. */
  reviewed?: boolean
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
  openingHours?: string
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
  contentType?: 'surprise' | 'known'
  contents?: string[]
  allergens?: Allergen[]
  /** Own photo; '' = use the location cover. */
  imageUrl?: string
  priceMinor: number
  originalPriceMinor: number
  priceDrop?: { at: string; priceMinor: number } | null
  quantityTotal: number
  maxPerReservation?: number
  pickupStart: string
  pickupEnd: string
}

export type OfferPatch = Partial<Omit<OfferInput, 'businessId'>> & { status?: 'active' | 'paused' }

// ---------------------------------------------------------------------------
// Admin

export interface AdminStats {
  users: { total: number; customers: number; partners: number; admins: number }
  businesses: { total: number; active: number }
  offers: { live: number }
  reservations: { total: number; today: number; upcoming: number; collected: number }
}

export type PartnerStatus = 'active' | 'paused' | 'blocked' | 'deleted'

export interface AdminUser extends User {
  businessCount: number
  isBlocked: boolean
  partnerStatus: PartnerStatus
}

export type PartnerNoteKind = 'warning' | 'paused' | 'blocked' | 'reactivated' | 'deleted'

export interface PartnerNote {
  id: string
  kind: PartnerNoteKind
  message: string
  createdAt: string
  resolvedAt: string | null
  /** Team member who wrote it (admin view only). */
  author: string | null
}

/** A partner's status and moderation history (partner portal + admin). */
export interface PartnerStanding {
  status: PartnerStatus
  reason: string | null
  since: string | null
  openWarnings: number
  history: PartnerNote[]
}

export interface AdminBusiness extends Business {
  owner: { id: string; name: string; email: string } | null
  liveOfferCount: number
}

/** One map pin: a location with live offers (GET /offers/locations). */
export interface OfferLocation {
  businessId: string
  name: string
  category: Category
  location: GeoPoint
  currency: string
  offerCount: number
  availableBags: number
  /** Cheapest offer that still has bags; null when everything is sold out. */
  minPriceMinor: number | null
}

export interface BoundingBox {
  minLat: number
  maxLat: number
  minLng: number
  maxLng: number
}

export type OfferFilters = Pick<OfferQuery, 'q' | 'category' | 'maxPriceMinor' | 'pickupDay' | 'timeOfDay'>

export interface SalesCounts {
  bagsTotal: number
  bagsRemaining: number
  bagsSold: number
  bagsCollected: number
  bagsPending: number
  bagsNoShow: number
  bagsCancelled: number
  revenueMinor: number
  expectedRevenueMinor: number
}

export interface SalesOfferRow extends SalesCounts {
  id: string
  title: string
  pickupStart: string
  pickupEnd: string
  timezone: string
  priceMinor: number
  currency: string
  status: 'active' | 'paused' | 'expired' | 'archived'
}

export interface SalesReport extends SalesCounts {
  date: string
  timezone: string
  currency: string
  businesses: (SalesCounts & { id: string; name: string; address: Address; offers: SalesOfferRow[] })[]
}

// ---------------------------------------------------------------------------
// Notifications, waitlist, sharing, partner applications, moderation

export type NotificationType =
  | 'reservation_new'
  | 'reservation_cancelled'
  | 'reservation_collected'
  | 'offer_new'
  | 'waitlist_available'
  | 'reservation_confirmed'
  | 'application_new'
  | 'staff_added'
  | 'support_new'
  | 'support_reply'
  | 'reward'
  | 'application_approved'
  | 'application_rejected'

export interface AppNotification {
  id: string
  type: NotificationType
  title: string
  body?: string
  link?: string
  read: boolean
  createdAt: string
}

/** Public "send to a friend" pickup pass. */
export interface PickupPass {
  reservationId: string
  code: string
  status: ReservationStatus
  quantity: number
  offerTitle: string
  totalMinor: number
  currency: string
  pickupStart: string
  pickupEnd: string
  timezone: string
  business: { id: string; name: string; address: Address; location: GeoPoint; collectionInstructions?: string; logoUrl?: string }
}

export type ApplicationStatus = 'pending' | 'approved' | 'rejected'

export interface PartnerApplicationInput {
  businessName: string
  contactName: string
  phone: string
  city: string
  category: Category
  locationsCount: number
  message?: string
}

export interface PartnerApplication extends PartnerApplicationInput {
  id: string
  status: ApplicationStatus
  reviewNote?: string
  reviewedAt?: string
  createdAt: string
  user?: { id: string; name: string; email: string }
}

export interface AdminReview {
  id: string
  rating: number
  comment?: string
  isHidden: boolean
  createdAt: string
  user: { name: string; email: string } | null
  business: { id: string; name: string } | null
}

export interface AuditEntry {
  id: string
  action: string
  targetType: string
  targetId: string
  summary: string
  actor: { id: string; name: string; email: string } | null
  createdAt: string
}

// ---------------------------------------------------------------------------
// Staff, support, promotions, donations, finance, integrations

export interface StaffMember {
  id: string
  name: string
  email: string
}

export type TicketCategory = 'order' | 'partner' | 'account' | 'other'
export type TicketStatus = 'open' | 'answered' | 'closed'

export interface SupportTicket {
  id: string
  subject: string
  category: TicketCategory
  status: TicketStatus
  reservationId?: string
  user: { id: string; name: string; email: string } | null
  lastMessageAt: string
  createdAt: string
  messageCount: number
  messages?: { body: string; fromTeam: boolean; author: string; createdAt: string }[]
}

export interface Promotion {
  id: string
  code: string
  description?: string
  discountType: 'percent' | 'fixed'
  value: number
  scope: 'platform' | 'partner'
  businessId?: string
  validFrom?: string
  validTo?: string
  maxUses: number | null
  usesCount: number
  perUserLimit: number
  isActive: boolean
  createdAt: string
}

export interface PromotionInput {
  code: string
  description?: string
  discountType: 'percent' | 'fixed'
  value: number
  businessId?: string
  validTo?: string
  maxUses?: number | null
  perUserLimit?: number
  platform?: boolean
}

export interface Donation {
  id: string
  businessId: string
  businessName?: string
  date: string
  organization: string
  bags: number
  weightKg?: number
  items?: string
  pickedUpBy?: string
  note?: string
}

export interface DonationList {
  totals: { count: number; bags: number; weightKg: number }
  items: Donation[]
}

export interface QuantitySuggestion {
  suggestedQuantity: number | null
  basedOnWeeks: number
  avgSold?: number
  avgTotal?: number
  sellThrough?: number
}

export interface StatementTotals {
  bags: number
  orders: number
  revenueMinor: number
  platformDiscountMinor: number
  grossMinor: number
  commissionMinor: number
  balanceMinor: number
}

export interface StatementLine extends StatementTotals {
  businessId: string
  name: string
  rate: number
}

export type SettlementStatus = 'none' | 'unpaid' | 'partial' | 'paid' | 'overpaid'
export type PaymentDirection = 'to_platform' | 'to_partner'
export type PaymentMethod = 'bank' | 'cash' | 'other'

export interface PartnerPayment {
  id: string
  month: string
  amountMinor: number
  direction: PaymentDirection
  method: PaymentMethod
  paidAt: string
  note?: string
  recordedBy: string | null
  createdAt: string
}

/** Paid against the balance and what is still open (> 0 partner owes, < 0 platform owes). */
export interface Settlement {
  settledMinor: number
  remainingMinor: number
  status: SettlementStatus
}

export interface PartnerStatement extends StatementTotals, Settlement {
  month: string
  currency: string
  payments: PartnerPayment[]
  businesses: StatementLine[]
}

export interface PlatformStatementPartner extends StatementTotals, Settlement {
  ownerId: string
  name: string
  email: string
  partnerStatus: PartnerStatus
  payments: PartnerPayment[]
  businesses: StatementLine[]
}

export interface PlatformStatement extends StatementTotals {
  month: string
  currency: string
  settledMinor: number
  owedToPlatformMinor: number
  owedToPartnersMinor: number
  paidPartners: number
  openPartners: number
  partners: PlatformStatementPartner[]
}

export interface OutstandingMonth extends Settlement {
  month: string
  balanceMinor: number
  /** Current month: not due yet. */
  inProgress: boolean
}

export interface Outstanding {
  currency: string
  currentMonth: string
  owedToPlatformMinor: number
  owedToPartnersMinor: number
  partners: { ownerId: string; name: string; email: string; partnerStatus: PartnerStatus; dueMinor: number; months: OutstandingMonth[] }[]
}

export interface PaymentInput {
  ownerId: string
  month: string
  amountMinor: number
  direction: PaymentDirection
  method: PaymentMethod
  paidAt?: string
  note?: string
}

export interface ApiKeyInfo {
  id: string
  name: string
  prefix: string
  lastUsedAt?: string
  createdAt: string
  /** Only once, right after creation. */
  key?: string
}

export type WebhookEvent = 'reservation.created' | 'reservation.cancelled' | 'reservation.collected'

export interface WebhookInfo {
  id: string
  url: string
  events: WebhookEvent[]
  isActive: boolean
  lastStatus?: number
  lastError?: string
  lastDeliveredAt?: string
  createdAt: string
  /** Only once, right after creation. */
  secret?: string
}
