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
  | 'integrity.view'
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
  /** E.164, e.g. +381641234567 (null for accounts created before phones were required). */
  phone?: string | null
  staffOf: string[]
  permissions: Permission[]
  notificationPrefs: { push: boolean; email: boolean }
  /** Only on GET /auth/me */
  points?: number
  level?: { key: string; name: string; nextAt: number | null; nextName: string | null }
  referralCode?: string | null
  /** Discount on the first bag when invited by a friend (until used); null otherwise. */
  welcomeDiscountPercent?: number | null
  /** What an invited friend gets (shown on the invite card). */
  referralDiscountPercent?: number
  /** Accepted legal documents (versions are dates) and whether the app must ask again. */
  legal?: LegalStatus
  createdAt: string
}

export interface LegalStatus {
  termsVersion: string
  privacyVersion: string
  termsAcceptedVersion: string | null
  termsAcceptedAt: string | null
  termsNeedsAcceptance: boolean
  partnerTermsVersion: string
  partnerTermsAcceptedVersion: string | null
  partnerTermsAcceptedAt: string | null
  partnerTermsNeedsAcceptance: boolean
}

export type LegalDocumentKind = 'terms' | 'partner_terms'

/** Admin view of a partner's onboarding. */
export interface PartnerOnboarding {
  partnerTermsAcceptedVersion: string | null
  partnerTermsAcceptedAt: string | null
  partnerTermsNeedsAcceptance: boolean
  /** "Nalog partnera je aktiviran" e-mail; null for partners promoted before it existed. */
  activationMail: { status: 'pending' | 'sending' | 'sent' | 'failed' | 'skipped'; attempts: number; sentAt: string | null; lastAttemptAt: string | null; error: string | null } | null
  /** Contract + Prilog A/B signed outside the app (recorded by the team). */
  contract: { signedAt: string; recordedAt: string; note: string | null } | null
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
  /** The partner's own delivery; null when it doesn't deliver (customers only see it when on). */
  delivery?: DeliverySettings | null
}

export interface DeliverySettings {
  enabled: boolean
  /** Minor units, location currency. */
  feeMinor: number
  /** Delivers within this distance of the location. */
  radiusKm: number
  /** Free delivery from this bags total; null = always paid. */
  freeFromMinor: number | null
}

export type Fulfillment = 'pickup' | 'delivery'
export const COURIER_MESSAGES = ['late_10', 'cant_find', 'calling'] as const
export const CUSTOMER_MESSAGES = ['coming_down', 'wait_5', 'call_me'] as const
export type DeliveryMessageKey = (typeof COURIER_MESSAGES)[number] | (typeof CUSTOMER_MESSAGES)[number]
export type DeliveryStage = 'preparing' | 'on_the_way' | 'delivered'

export interface ReservationDelivery {
  address: string
  location: GeoPoint
  note: string | null
  feeMinor: number
  distanceMeters: number
  stage: DeliveryStage
  courierName: string | null
  startedAt: string | null
  deliveredAt: string | null
  /** Courier tapped "Stigao sam". */
  arrivedAt?: string | null
  /** Quick preset messages, oldest first. */
  messages?: { from: 'courier' | 'customer'; key: DeliveryMessageKey; at: string }[]
  /** Live courier position while on the way (sent by the courier's phone). */
  courierLocation: { lat: number; lng: number; heading: number | null; at: string } | null
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
  /** Paid "Istaknuto": listed first with a badge. */
  boosted?: boolean
  /** Published by a repeating offer. */
  scheduleId?: string
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
  /** Currency of maxPriceMinor. */
  currency?: string
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
  /** Only included for the business's own staff (phone: for the courier). */
  customer?: { name: string; phone?: string }
  fulfillment: Fulfillment
  delivery: ReservationDelivery | null
  /** The customer's phone was at the shop during the pickup window. */
  presence?: { firstAt: string; lastAt: string; minDistanceMeters: number } | null
  /** Platform warning: at the shop, but not scanned / cancelled by the partner. */
  integrityAlert?: { kind: 'arrived_not_scanned' | 'arrived_cancelled'; at: string } | null
  /** Paid at the counter / to the courier: bags + delivery fee. */
  amountDueMinor: number
  cancelledAt?: string
  collectedAt?: string
  /** How the hand-over was recorded; "customer" = confirmed by the customer, not scanned. */
  collectedVia?: 'qr' | 'code' | 'list' | 'customer' | null
  /** "Did you pick it up?" asked when the reservation expired unclaimed. */
  pickupCheck?: { askedAt: string; answer: 'collected' | 'not_collected' | null } | null
  dispute?: { status: 'open' | 'upheld' | 'rejected'; reason: string; openedAt: string; note: string | null } | null
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
  /** Customer photos of the bag. */
  photos?: string[]
  user: { id: string; name: string }
  createdAt: string
}

export interface ReviewPhoto {
  url: string
  reviewId: string
  rating: number
  user: string
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
  delivery?: DeliverySettings
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
  /** Only for partners. */
  partnerOnboarding?: PartnerOnboarding
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

export type OfferFilters = Pick<OfferQuery, 'q' | 'category' | 'maxPriceMinor' | 'currency' | 'pickupDay' | 'timeOfDay'>

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
  | 'delivery_started'
  | 'delivery_arrived'
  | 'delivery_message'
  | 'offer_boost'
  | 'challenge'
  | 'integrity_alert'
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
  countryCode?: string | null
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
  /** Currency of a fixed discount (the code only applies to offers in it). */
  currency: string | null
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
  currency?: string
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
  /** Paid promotions bought in the month. */
  boostMinor?: number
  balanceMinor: number
}

export interface StatementLine extends StatementTotals {
  businessId: string
  name: string
  currency: string
  rate: number
}

export type SettlementStatus = 'none' | 'unpaid' | 'partial' | 'paid' | 'overpaid'
export type PaymentDirection = 'to_platform' | 'to_partner'
export type PaymentMethod = 'bank' | 'cash' | 'other'

export interface PartnerPayment {
  id: string
  month: string
  amountMinor: number
  currency: string
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
  boosts?: BoostCharge[]
}

export type BoostKind = 'top' | 'push'

export interface BoostCharge {
  id: string
  kind: BoostKind
  priceMinor: number
  currency: string
  offerTitle: string
  businessName: string
  recipients: number | null
  createdAt: string
  timezone: string
}

export interface BoostOptions {
  currency: string
  top: { priceMinor: number; bought: boolean }
  /** audience = followers (always) + recent customers who don't follow (max one promo push a day). */
  push: { priceMinor: number; bought: boolean; recipients: number | null; audience: number; followers: number; customers: number }
}

export interface OfferSchedule {
  id: string
  businessId: string
  businessName?: string
  title: string
  description: string
  category: Category
  imageUrl?: string
  tags: string[]
  contentType: 'surprise' | 'known'
  contents: string[]
  allergens: Allergen[]
  priceMinor: number
  originalPriceMinor: number
  priceDrop: { time: string; priceMinor: number } | null
  quantity: number
  maxPerReservation: number | null
  startTime: string
  endTime: string
  /** 1 = Monday … 7 = Sunday. */
  weekdays: number[]
  isActive: boolean
  lastDate: string | null
  createdAt: string
}

export interface OfferScheduleInput {
  businessId: string
  title: string
  description: string
  category?: Category
  imageUrl?: string
  priceMinor: number
  originalPriceMinor: number
  priceDrop?: { time: string; priceMinor: number } | null
  quantity: number
  startTime: string
  endTime: string
  weekdays: number[]
}

export interface BagSuggestion {
  weeks: number
  days: {
    weekday: number
    days: number
    avgOffered: number | null
    avgSold: number | null
    sellThrough: number | null
    soldOutDays: number
    suggested: number | null
  }[]
}

export interface Impact {
  bags: number
  kgFood: number
  co2Kg: number
  savings: { currency: string; minor: number }[]
  places: number
  week: { bags: number; goal: number; bonus: number; done: boolean }
  streak: { weeks: number; step: number; bonus: number; nextAt: number }
  badges: { key: 'first' | 'ten' | 'fifty' | 'explorer' | 'early' | 'night' | 'streak'; earned: boolean }[]
  recap: {
    year: number
    bags: number
    kgFood: number
    co2Kg: number
    savings: { currency: string; minor: number }[]
    places: number
    topPlace: { id: string; name: string; logoUrl: string | null; bags: number } | null
    topCategory: Category | null
    perMonth: number[]
    bestMonth: number | null
    firstPickup: string | null
  }
}

export interface PlatformStatementPartner extends StatementTotals, Settlement {
  ownerId: string
  name: string
  email: string
  partnerStatus: PartnerStatus
  /** The partner's currency (all their locations share one). */
  currency: string
  payments: PartnerPayment[]
  businesses: StatementLine[]
}

/** Platform totals for one currency — different currencies are never added together. */
export interface CurrencyTotals extends StatementTotals {
  currency: string
  settledMinor: number
  owedToPlatformMinor: number
  owedToPartnersMinor: number
}

export interface PlatformStatement {
  month: string
  currencies: CurrencyTotals[]
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
  currentMonth: string
  currencies: { currency: string; owedToPlatformMinor: number; owedToPartnersMinor: number }[]
  partners: { ownerId: string; name: string; email: string; partnerStatus: PartnerStatus; currency: string; dueMinor: number; months: OutstandingMonth[] }[]
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

/** Result of checking a pickup code at the counter (POST /reservations/verify). */
export type ScanVerdict =
  | 'valid'
  | 'early'
  | 'late'
  | 'already_collected'
  | 'cancelled'
  | 'expired'
  | 'not_paid'
  | 'not_found'
  | 'other_location'
  | 'ambiguous'

export interface VerifyResult {
  verdict: ScanVerdict
  reservation?: Reservation
  /** Another location of the same partner. */
  businessName?: string
}

export interface PickupCounts {
  total: number
  collected: number
  expired: number
  viaQr: number
  viaCode: number
  viaList: number
  viaCustomer: number
  customerNo: number
  expiredGrossMinor: number
  /** Customer's phone was at the shop but nothing was scanned (or the partner cancelled). */
  arrivedNotScanned?: number
  noShowRate: number
  scannedRate: number
}

export interface PartnerIntegrity extends PickupCounts {
  days: number
  platformNoShowRate: number
  customerConfirmed: Reservation[]
}

export interface PartnerStatsRow {
  total: number
  collected: number
  /** Collected by scanning the QR or typing the code. */
  scanned: number
  /** Collected with "Izdaj" in the order list (no code). */
  manual: number
  /** Confirmed by the customer, not recorded by the partner. */
  byCustomer: number
  expired: number
  cancelledByCustomer: number
  cancelledByPartner: number
  active: number
  deliveries: number
  bagsCollected: number
  revenueMinor: number
  expiredValueMinor: number
  arrivalWarnings: number
}

export interface PartnerStats {
  days: number
  currency: string | null
  totals: PartnerStatsRow
  locations: (PartnerStatsRow & { businessId: string; name: string; deleted: boolean })[]
}

export type RiskFlag = 'high_no_show' | 'unscanned_pickups' | 'repeat_no_shows' | 'manual_handover' | 'arrived_not_scanned'

export interface PartnerRisk extends PickupCounts {
  ownerId: string
  name: string
  email: string
  partnerStatus: PartnerStatus
  locations: string[]
  currency: string
  repeatNoShowCustomers: number
  commissionAtRiskMinor: number
  openDisputes: number
  flags: RiskFlag[]
  risk: 'low' | 'medium' | 'high'
}

export interface PlatformIntegrity {
  days: number
  platform: PickupCounts
  partners: PartnerRisk[]
}

/** Owner's staff across all locations (GET /partner/team). */
export interface Team {
  locations: { id: string; name: string; address: Address }[]
  members: { id: string; name: string; email: string; businessIds: string[] }[]
}

export interface StaffAccess {
  ownerId: string | null
  businessIds: string[]
}
