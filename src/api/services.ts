/**
 * Typed functions for every REST endpoint. Screens only talk to these (via
 * the hooks in src/hooks), so swapping mock ↔ real backend is a config change.
 */
import { api } from './client'
import type {
  StaffAccess,
  Team,
  PartnerIntegrity,
  PlatformIntegrity,
  VerifyResult,
  ApiKeyInfo,
  Donation,
  DonationList,
  Outstanding,
  PartnerNote,
  PartnerPayment,
  PartnerStanding,
  PartnerStatement,
  PaymentInput,
  PlatformStatement,
  Promotion,
  PromotionInput,
  QuantitySuggestion,
  StaffMember,
  SupportTicket,
  TicketCategory,
  TicketStatus,
  WebhookEvent,
  WebhookInfo,
  AdminBusiness,
  AdminReview,
  AppNotification,
  ApplicationStatus,
  AuditEntry,
  PartnerApplication,
  PartnerApplicationInput,
  PickupPass,
  ReservationStatus,
  AdminStats,
  AdminUser,
  ApiList,
  ApiSuccess,
  AuthResult,
  Business,
  BoundingBox,
  BusinessInput,
  Favorite,
  FavoriteTarget,
  Offer,
  OfferFilters,
  OfferInput,
  OfferLocation,
  OfferPatch,
  OfferQuery,
  Reservation,
  Review,
  Role,
  SalesReport,
  User,
  BagSuggestion,
  BoostKind,
  BoostOptions,
  DeliveryMessageKey,
  Impact,
  OfferSchedule,
  OfferScheduleInput,
  ReviewPhoto,
  PartnerStats,
} from './types'

const unwrap = <T>(promise: Promise<{ data: ApiSuccess<T> }>) => promise.then((res) => res.data.data)

export const authApi = {
  login: (body: { email: string; password: string }) => unwrap<AuthResult>(api.post('/auth/login', body)),
  register: (body: { name: string; email: string; password: string; phone: string; referralCode?: string; countryCode?: string }) =>
    unwrap<AuthResult>(api.post('/auth/register', body)),
  me: () => unwrap<User>(api.get('/auth/me')),
  forgotPassword: (email: string) => unwrap<{ sent: boolean }>(api.post('/auth/forgot-password', { email })),
  resetPassword: (body: { token: string; password: string }) => unwrap<AuthResult>(api.post('/auth/reset-password', body)),
  /** GDPR: everything stored about me (JSON). */
  exportMyData: () => unwrap<Record<string, unknown>>(api.get('/auth/me/export')),
  deleteAccount: (password: string) => api.delete('/auth/me', { data: { password } }).then(() => undefined),
  updatePreferences: (prefs: { push?: boolean; email?: boolean }) => unwrap<User>(api.patch('/auth/me/preferences', prefs)),
  updateProfile: (body: { name?: string; avatarUrl?: string; countryCode?: string; phone?: string }) => unwrap<User>(api.patch('/auth/me', body)),
  /** "Moj uticaj": totals, weekly challenge, streak, badges, yearly recap. */
  impact: (year?: number) => unwrap<Impact>(api.get('/auth/me/impact', { params: { year } })),
}

export const schedulesApi = {
  list: () => unwrap<OfferSchedule[]>(api.get('/offer-schedules')),
  create: (body: OfferScheduleInput) => unwrap<OfferSchedule>(api.post('/offer-schedules', body)),
  update: (id: string, body: Partial<OfferScheduleInput> & { isActive?: boolean }) => unwrap<OfferSchedule>(api.patch(`/offer-schedules/${id}`, body)),
  remove: (id: string) => api.delete(`/offer-schedules/${id}`).then(() => undefined),
  /** How many bags to offer per weekday (from the last weeks' sales). */
  suggestion: (businessId: string) => unwrap<BagSuggestion>(api.get('/offer-schedules/recommendation', { params: { businessId } })),
}

export const offersApi = {
  list: (params: OfferQuery = {}) => api.get<ApiList<Offer>>('/offers', { params }).then((res) => res.data),
  get: (id: string) => unwrap<Offer>(api.get(`/offers/${id}`)),
  /** Map pins for the visible area — one per location, at any zoom level. */
  locations: (params: OfferFilters & BoundingBox) => unwrap<OfferLocation[]>(api.get('/offers/locations', { params })),
  create: (body: OfferInput) => unwrap<Offer>(api.post('/offers', body)),
  update: (id: string, body: OfferPatch) => unwrap<Offer>(api.patch(`/offers/${id}`, body)),
  remove: (id: string) => api.delete(`/offers/${id}`).then(() => undefined),
  boostOptions: (id: string) => unwrap<BoostOptions>(api.get(`/offers/${id}/boost`)),
  /** Paid promotion; added to the monthly statement. */
  boost: (id: string, kind: BoostKind) => unwrap<{ id: string; kind: BoostKind; priceMinor: number; currency: string; recipients: number | null }>(api.post(`/offers/${id}/boost`, { kind })),
}

export const businessesApi = {
  list: (params: { owner?: 'me'; city?: string; sort?: 'name' | 'new'; limit?: number } = {}) =>
    api.get<ApiList<Business>>('/businesses', { params }).then((res) => res.data),
  get: (id: string) => unwrap<Business>(api.get(`/businesses/${id}`)),
  create: (body: BusinessInput) => unwrap<Business>(api.post('/businesses', body)),
  update: (id: string, body: Partial<BusinessInput>) => unwrap<Business>(api.patch(`/businesses/${id}`, body)),
  remove: (id: string) => api.delete(`/businesses/${id}`).then(() => undefined),
  /** Partner view: every offer of the location, including paused and past ones. */
  offers: (id: string) => api.get<ApiList<Offer>>(`/businesses/${id}/offers`).then((res) => res.data),
  staff: (id: string) => unwrap<StaffMember[]>(api.get(`/businesses/${id}/staff`)),
  addStaff: (id: string, email: string) => unwrap<StaffMember>(api.post(`/businesses/${id}/staff`, { email })),
  removeStaff: (id: string, userId: string) => api.delete(`/businesses/${id}/staff/${userId}`).then(() => undefined),
  reviews: (id: string) => api.get<ApiList<Review>>(`/businesses/${id}/reviews`).then((res) => res.data),
  addReview: (id: string, body: { reservationId: string; rating: number; comment?: string; photos?: string[] }) =>
    unwrap<Review>(api.post(`/businesses/${id}/reviews`, body)),
  /** "Šta je bilo u kesi": latest customer photos. */
  photos: (id: string) => unwrap<ReviewPhoto[]>(api.get(`/businesses/${id}/photos`)),
}

export interface CreateReservationBody {
  offerId: string
  quantity: number
  promoCode?: string
  fulfillment?: 'pickup' | 'delivery'
  delivery?: { address: string; lat: number; lng: number; note?: string }
}

export const reservationsApi = {
  list: (params: { scope?: 'upcoming' | 'history'; businessId?: string; limit?: number } = {}) =>
    api.get<ApiList<Reservation>>('/reservations', { params }).then((res) => res.data),
  get: (id: string) => unwrap<Reservation>(api.get(`/reservations/${id}`)),
  create: (body: CreateReservationBody) => unwrap<Reservation>(api.post('/reservations', body)),
  /** Staff: "Krećem" — become the courier of a delivery. */
  startDelivery: (id: string) => unwrap<Reservation>(api.post(`/reservations/${id}/delivery/start`)),
  /** Courier's phone position while delivering. */
  /** Customer's phone near the shop during the pickup window (arrival check). */
  presence: (id: string, body: { lat: number; lng: number; accuracy: number }) =>
    unwrap<{ near: boolean; recorded: boolean; distanceMeters?: number; firstAt?: string }>(api.post(`/reservations/${id}/presence`, body)),
  /** Courier: "Stigao sam". */
  courierArrived: (id: string) => unwrap<Reservation>(api.post(`/reservations/${id}/delivery/arrived`)),
  /** Preset quick message (customer ↔ courier). */
  deliveryMessage: (id: string, key: DeliveryMessageKey) => unwrap<Reservation>(api.post(`/reservations/${id}/delivery/message`, { key })),
  courierLocation: (id: string, body: { lat: number; lng: number; heading?: number | null }) => api.post(`/reservations/${id}/delivery/location`, body).then(() => undefined),
  cancel: (id: string) => unwrap<Reservation>(api.patch(`/reservations/${id}/cancel`)),
  /** Secret link a friend can use to pick the bag up. */
  share: (id: string) => unwrap<{ token: string }>(api.post(`/reservations/${id}/share`)),
  pickupPass: (token: string) => unwrap<PickupPass>(api.get(`/pickup/${token}`)),
  /** Business staff: hand over by id (from the list). */
  collect: (id: string) => unwrap<Reservation>(api.patch(`/reservations/${id}/collect`)),
  /** Business staff: hand over by scanned QR (code + id) or a typed code. */
  collectByCode: (body: { code: string; reservationId?: string; via?: 'qr' | 'code' }) => unwrap<Reservation>(api.post('/reservations/collect', body)),
  /** Check a scanned/typed code without handing the bag over. */
  verify: (body: { code: string; reservationId?: string }) => unwrap<VerifyResult>(api.post('/reservations/verify', body)),
  /** Customer: "did you pick it up?" for an expired reservation. */
  pickupCheck: (id: string, answer: 'collected' | 'not_collected') => unwrap<Reservation>(api.post(`/reservations/${id}/pickup-check`, { answer })),
  /** Partner: dispute a pickup the customer confirmed. */
  dispute: (id: string, reason: string) => unwrap<Reservation>(api.post(`/reservations/${id}/dispute`, { reason })),
}

export const favoritesApi = {
  list: () => api.get<ApiList<Favorite>>('/favorites').then((res) => res.data),
  add: (body: { targetType: FavoriteTarget; targetId: string }) => unwrap<Favorite>(api.post('/favorites', body)),
  remove: (id: string) => api.delete(`/favorites/${id}`).then(() => undefined),
}

export const adminApi = {
  stats: () => unwrap<AdminStats>(api.get('/admin/stats')),
  users: (params: { q?: string; role?: Role; limit?: number }) =>
    api.get<ApiList<AdminUser>>('/admin/users', { params }).then((res) => res.data),
  setRole: (id: string, role: Role) => unwrap<AdminUser>(api.patch(`/admin/users/${id}/role`, { role })),
  businesses: (params: { q?: string; status?: 'active' | 'inactive'; limit?: number }) =>
    api.get<ApiList<AdminBusiness>>('/admin/businesses', { params }).then((res) => res.data),
  setBlocked: (id: string, blocked: boolean) => unwrap<AdminUser>(api.patch(`/admin/users/${id}/block`, { blocked })),
  reservations: (params: { status?: ReservationStatus; q?: string; limit?: number }) =>
    api.get<ApiList<Reservation>>('/admin/reservations', { params }).then((res) => res.data),
  reviews: (params: { hidden?: boolean; limit?: number }) => api.get<ApiList<AdminReview>>('/admin/reviews', { params }).then((res) => res.data),
  setReviewHidden: (id: string, hidden: boolean) => unwrap<{ id: string; isHidden: boolean }>(api.patch(`/admin/reviews/${id}`, { hidden })),
  applications: (params: { status?: ApplicationStatus; limit?: number }) =>
    api.get<ApiList<PartnerApplication>>('/admin/applications', { params }).then((res) => res.data),
  decideApplication: (id: string, body: { status: 'approved' | 'rejected'; note?: string }) =>
    unwrap<PartnerApplication>(api.patch(`/admin/applications/${id}`, body)),
  audit: (params: { limit?: number }) => api.get<ApiList<AuditEntry>>('/admin/audit', { params }).then((res) => res.data),
  support: (params: { status?: TicketStatus }) => api.get<ApiList<SupportTicket>>('/admin/support', { params }).then((res) => res.data),
  statement: (month: string) => unwrap<PlatformStatement>(api.get('/admin/statements', { params: { month } })),
  outstanding: () => unwrap<Outstanding>(api.get('/admin/statements/outstanding')),
  recordPayment: (body: PaymentInput) => unwrap<PartnerPayment>(api.post('/admin/payments', body)),
  deletePayment: (id: string) => api.delete(`/admin/payments/${id}`).then(() => undefined),
  partnerStanding: (id: string) => unwrap<PartnerStanding>(api.get(`/admin/partners/${id}/standing`)),
  setPartnerStatus: (id: string, body: { status: 'active' | 'paused' | 'blocked'; reason?: string }) =>
    unwrap<PartnerStanding>(api.patch(`/admin/partners/${id}/status`, body)),
  warnPartner: (id: string, message: string) => unwrap<PartnerNote>(api.post(`/admin/partners/${id}/warnings`, { message })),
  resolveWarning: (noteId: string) => unwrap<PartnerNote>(api.patch(`/admin/partner-notes/${noteId}/resolve`)),
  integrity: (days = 30) => unwrap<PlatformIntegrity>(api.get('/admin/integrity', { params: { days } })),
  staffAccess: (userId: string) => unwrap<StaffAccess>(api.get(`/admin/users/${userId}/staff-access`)),
  setStaffAccess: (userId: string, businessIds: string[]) => unwrap<StaffAccess>(api.put(`/admin/users/${userId}/staff-access`, { businessIds })),
  disputes: () => unwrap<Reservation[]>(api.get('/admin/disputes')),
  /** One partner's reservations by outcome (days = 0 → all time). */
  partnerStats: (ownerId: string, days: number) => unwrap<PartnerStats>(api.get(`/admin/partners/${ownerId}/stats`, { params: { days } })),
  /** Arrival warnings: customer at the shop, nothing recorded. */
  integrityAlerts: () => unwrap<Reservation[]>(api.get('/admin/integrity/alerts')),
  resolveDispute: (id: string, body: { decision: 'upheld' | 'rejected'; note?: string }) => unwrap<Reservation>(api.patch(`/admin/disputes/${id}`, body)),
  deletePartner: (id: string, reason: string) => api.delete(`/admin/partners/${id}`, { data: { reason } }).then(() => undefined),
  setCommission: (businessId: string, rate: number | null) => unwrap<{ businessId: string; commissionRate: number | null }>(api.patch(`/admin/businesses/${businessId}/commission`, { rate })),
  donations: () => unwrap<DonationList>(api.get('/admin/donations')),
}

export const partnerApi = {
  /** Sales and stock for one local day (YYYY-MM-DD, default today). */
  sales: (params: { date?: string; businessId?: string }) => unwrap<SalesReport>(api.get('/partner/sales', { params })),
  orders: (params: { date?: string; status?: 'active' | 'collected' | 'cancelled' | 'expired'; businessId?: string }) =>
    api.get<{ data: Reservation[]; meta: { date: string; total: number } }>('/partner/orders', { params }).then((res) => res.data),
  apply: (body: PartnerApplicationInput) => unwrap<PartnerApplication>(api.post('/partner-applications', body)),
  myApplication: () => unwrap<PartnerApplication | null>(api.get('/partner-applications/me')),
  workplaces: () => unwrap<{ id: string; name: string; address: { street: string; city: string } }[]>(api.get('/partner/workplaces')),
  suggestion: (businessId: string, date: string) => unwrap<QuantitySuggestion>(api.get('/partner/suggestion', { params: { businessId, date } })),
  donations: () => unwrap<DonationList>(api.get('/partner/donations')),
  addDonation: (body: Omit<Donation, 'id' | 'businessName'>) => unwrap<Donation>(api.post('/partner/donations', body)),
  deleteDonation: (id: string) => api.delete(`/partner/donations/${id}`).then(() => undefined),
  statement: (month: string) => unwrap<PartnerStatement>(api.get('/partner/statements', { params: { month } })),
  outstanding: () => unwrap<Outstanding>(api.get('/partner/statements/outstanding')),
  standing: () => unwrap<PartnerStanding>(api.get('/partner/standing')),
  integrity: (days = 30) => unwrap<PartnerIntegrity>(api.get('/partner/integrity', { params: { days } })),
  team: () => unwrap<Team>(api.get('/partner/team')),
  addTeamMember: (body: { email: string; businessIds: string[] }) => unwrap<Team['members'][number]>(api.post('/partner/team', body)),
  updateTeamMember: (userId: string, businessIds: string[]) => unwrap<Team['members'][number]>(api.put(`/partner/team/${userId}`, { businessIds })),
  apiKeys: () => unwrap<ApiKeyInfo[]>(api.get('/partner/api-keys')),
  createApiKey: (name: string) => unwrap<ApiKeyInfo>(api.post('/partner/api-keys', { name })),
  revokeApiKey: (id: string) => api.delete(`/partner/api-keys/${id}`).then(() => undefined),
  webhooks: () => unwrap<WebhookInfo[]>(api.get('/partner/webhooks')),
  createWebhook: (body: { url: string; events?: WebhookEvent[] }) => unwrap<WebhookInfo>(api.post('/partner/webhooks', body)),
  updateWebhook: (id: string, body: { isActive?: boolean }) => unwrap<WebhookInfo>(api.patch(`/partner/webhooks/${id}`, body)),
  deleteWebhook: (id: string) => api.delete(`/partner/webhooks/${id}`).then(() => undefined),
  testWebhook: (id: string) => unwrap<{ status: number }>(api.post(`/partner/webhooks/${id}/test`)),
}

export const supportApi = {
  mine: () => unwrap<SupportTicket[]>(api.get('/support')),
  get: (id: string) => unwrap<SupportTicket>(api.get(`/support/${id}`)),
  create: (body: { subject: string; category: TicketCategory; message: string; reservationId?: string }) => unwrap<SupportTicket>(api.post('/support', body)),
  reply: (id: string, body: string) => unwrap<SupportTicket>(api.post(`/support/${id}/messages`, { body })),
  close: (id: string) => unwrap<SupportTicket>(api.patch(`/support/${id}/close`)),
}

export const promotionsApi = {
  list: (scope: 'mine' | 'platform' | 'all' = 'mine') => unwrap<Promotion[]>(api.get('/promotions', { params: { scope } })),
  create: (body: PromotionInput) => unwrap<Promotion>(api.post('/promotions', body)),
  update: (id: string, body: { isActive?: boolean }) => unwrap<Promotion>(api.patch(`/promotions/${id}`, body)),
  check: (body: { code: string; offerId: string; quantity: number }) =>
    unwrap<{ code: string; description?: string; discountMinor: number; totalMinor: number }>(api.post('/promotions/check', body)),
}

export const pushApi = {
  key: () => unwrap<{ enabled: boolean; publicKey: string | null }>(api.get('/push/key')),
  subscribe: (sub: PushSubscriptionJSON) => api.post('/push/subscriptions', sub).then(() => undefined),
  unsubscribe: (endpoint: string) => api.delete('/push/subscriptions', { data: { endpoint } }).then(() => undefined),
}

export const notificationsApi = {
  list: () => unwrap<{ unread: number; items: AppNotification[] }>(api.get('/notifications')),
  unreadCount: () => unwrap<{ unread: number }>(api.get('/notifications/unread-count')),
  readAll: () => unwrap<{ unread: number }>(api.post('/notifications/read-all')),
}

export const waitlistApi = {
  mine: () => unwrap<string[]>(api.get('/waitlist')),
  join: (offerId: string) => api.put(`/waitlist/${offerId}`).then(() => undefined),
  leave: (offerId: string) => api.delete(`/waitlist/${offerId}`).then(() => undefined),
}

export type ImageKind = 'avatar' | 'business-logo' | 'business-cover' | 'offer' | 'review'

export const uploadsApi = {
  /** Sends the image to the API, which resizes it and stores it on R2. */
  image: (file: File, kind: ImageKind) => {
    const form = new FormData()
    form.append('file', file)
    return unwrap<{ url: string; bytes: number }>(
      api.post('/uploads', form, { params: { kind }, headers: { 'Content-Type': 'multipart/form-data' }, timeout: 60_000 }),
    )
  },
}
